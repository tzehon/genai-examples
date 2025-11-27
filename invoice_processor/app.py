import streamlit as st
import anthropic
import pymongo
import tempfile
from typing import Any, Dict, List, Optional, Union
import json
from datetime import datetime
from sentence_transformers import SentenceTransformer
import fitz  # PyMuPDF
from bson import ObjectId
from merchant_classifier import MultilingualMerchantClassifier


class PipelineValidationError(Exception):
    """Raised when a MongoDB pipeline contains disallowed operations."""
    pass


# Security: Allowlist of safe MongoDB aggregation stages
ALLOWED_PIPELINE_STAGES = {
    "$match",
    "$group",
    "$sort",
    "$limit",
    "$skip",
    "$project",
    "$unwind",
    "$lookup",
    "$count",
    "$addFields",
}

# Security: Stages that can write/modify data - must be blocked
BLOCKED_PIPELINE_STAGES = {
    "$out",
    "$merge",
    "$set",
    "$unset",
    "$replaceRoot",
    "$replaceWith",
}

# Security: Collections that can be accessed via $lookup
ALLOWED_COLLECTIONS = {"documents", "merchants"}


def validate_pipeline(pipeline: list) -> None:
    """
    Validate a MongoDB aggregation pipeline for security.

    Raises PipelineValidationError if the pipeline contains:
    - Disallowed stages (e.g., $out, $merge that can write data)
    - $lookup to collections not in the allowlist

    Args:
        pipeline: List of pipeline stages to validate

    Raises:
        PipelineValidationError: If pipeline contains dangerous operations
    """
    if not isinstance(pipeline, list):
        raise PipelineValidationError("Pipeline must be a list of stages")

    for i, stage in enumerate(pipeline):
        if not isinstance(stage, dict):
            raise PipelineValidationError(f"Stage {i} must be a dictionary")

        for stage_name, stage_content in stage.items():
            # Check for blocked stages (write operations)
            if stage_name in BLOCKED_PIPELINE_STAGES:
                raise PipelineValidationError(
                    f"Stage '{stage_name}' is not allowed - write operations are blocked"
                )

            # Check if stage is in allowlist
            if stage_name not in ALLOWED_PIPELINE_STAGES:
                raise PipelineValidationError(
                    f"Stage '{stage_name}' is not in the allowed stages list"
                )

            # Validate $lookup targets only allowed collections
            if stage_name == "$lookup":
                if isinstance(stage_content, dict):
                    target_collection = stage_content.get("from")
                    if target_collection and target_collection not in ALLOWED_COLLECTIONS:
                        raise PipelineValidationError(
                            f"$lookup to collection '{target_collection}' is not allowed. "
                            f"Allowed collections: {ALLOWED_COLLECTIONS}"
                        )

def init_connections():
    """Initialize connections to MongoDB and Claude."""
    # Initialize MongoDB connection
    client = pymongo.MongoClient(st.secrets["mongodb_uri"])
    db = client[st.secrets["database_name"]]

    # Initialize Claude client
    claude = anthropic.Client(api_key=st.secrets["anthropic_api_key"])

    # Initialize merchant classifier
    merchant_classifier = MultilingualMerchantClassifier(
        st.secrets["mongodb_uri"],
        st.secrets["database_name"]
    )

    return db, claude, merchant_classifier

def extract_text_from_pdf(pdf_file) -> str:
    """Extract text from uploaded PDF file."""
    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
        tmp_file.write(pdf_file.getvalue())
        tmp_file.seek(0)

        doc = fitz.open(tmp_file.name)
        text = ""
        for page in doc:
            text += page.get_text()
        return text

def extract_metadata_with_claude(
    claude: anthropic.Client,
    text: str
) -> Dict[str, Any]:
    """Extract metadata from text using Claude."""
    prompt = f"""Extract the following metadata from this document text. Return as JSON:
    - merchant_name: The business or merchant name
    - date: The transaction or document date
    - total_amount: Any total amount mentioned
    - category: The type of document (receipt, invoice, statement, etc.)
    - currency: The currency used
    - payment_method: The payment method if mentioned
    - items: Array of items/services mentioned with prices if available

    Document text:
    {text[:2000]}  # Limiting text length for prompt

    Return only the JSON without any explanation.
    """

    message = claude.messages.create(
        model="claude-sonnet-4-5-20250929",
        max_tokens=1000,
        temperature=0,
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ]
    )

    # Get the response and clean it before parsing
    response = message.content[0].text.strip()

    # Remove markdown code blocks if present
    if response.startswith('```json'):
        response = response.split('```json')[1]
    if response.startswith('```'):
        response = response.split('```')[1]
    if response.endswith('```'):
        response = response.rsplit('```', 1)[0]
    response = response.strip()

    try:
        return json.loads(response)
    except json.JSONDecodeError as e:
        # Print the response for debugging
        print(f"Failed to parse JSON. Response was: {response}")
        raise ValueError(f"Claude returned invalid JSON: {e}") from e

def process_natural_language_query(
    claude: anthropic.Client,
    query: str
) -> str:
    """Convert natural language query to MongoDB query using Claude."""
    prompt = f"""Convert this natural language query into a MongoDB aggregation pipeline:
    "{query}"

    CRITICAL: When a merchant name is mentioned in the query, use the EXACT merchant name as it appears in the query.
    For example:
    - "Grab Singapore" should search for exactly "Grab Singapore" (not just "Grab")
    - "McDonald's" should search for exactly "McDonald's"
    - Extract the full merchant name from the query and use it verbatim

    The database has two collections:

    documents collection:
    - merchant_id (ObjectId reference to merchants collection)
    - merchant_name (string)
    - total_amount (number)
    - date (string/date)
    - category (string)
    - currency (string)
    - payment_method (string)
    - items (array)

    merchants collection:
    - _id (ObjectId)
    - canonical_name (string, e.g., "Grab Singapore", "M1 Limited")
    - synonyms (array of strings)

    Here's the exact format to use (example with MERCHANT_NAME as placeholder):
    [
      {{
        "$lookup": {{
          "from": "merchants",
          "let": {{
            "merchant_id": "$merchant_id"
          }},
          "pipeline": [
            {{
              "$match": {{
                "$expr": {{
                  "$and": [
                    {{ "$eq": ["$_id", "$$merchant_id"] }},
                    {{
                      "$or": [
                        {{ "$eq": ["$canonical_name", "MERCHANT_NAME"] }},
                        {{ "$in": ["MERCHANT_NAME", "$synonyms"] }}
                      ]
                    }}
                  ]
                }}
              }}
            }}
          ],
          "as": "merchant_details"
        }}
      }},
      {{
        "$match": {{
          "merchant_details": {{ "$ne": [] }}
        }}
      }},
      {{
        "$group": {{
          "_id": null,
          "total_spend": {{ "$sum": "$total_amount" }}
        }}
      }}
    ]

    Important:
    1. Use EXACT merchant name from the query - do not abbreviate or modify it
    2. Use exact operator syntax: "$eq", "$ne", "$in", etc.
    3. Always use proper JSON formatting
    4. For string comparison use exact match, not regex
    5. The $lookup must use let/expr pattern as shown above

    Return only the valid JSON array for the MongoDB aggregation pipeline. No explanation.
    Format dates using ISODate() where needed."""

    message = claude.messages.create(
        model="claude-sonnet-4-5-20250929",
        max_tokens=1000,
        temperature=0,
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ]
    )

    # Get the response and ensure it's valid JSON
    response = message.content[0].text.strip()

    # Remove markdown code blocks if present
    if response.startswith('```json'):
        response = response.split('```json')[1]
    if response.startswith('```'):
        response = response.split('```')[1]
    if response.endswith('```'):
        response = response.rsplit('```', 1)[0]
    response = response.strip()

    # Add error handling for debugging
    try:
        # Validate it's valid JSON before returning
        json.loads(response)
        return response
    except json.JSONDecodeError as e:
        print(f"Failed to parse MongoDB query. Response was: {response}")
        raise ValueError(f"Claude returned invalid JSON: {e}") from e

def main():
    st.title("Receipt Processor")

    # Initialize connections
    db, claude, merchant_classifier = init_connections()

    # Create tabs
    tab1, tab2 = st.tabs(["PDF Processing", "Query Database"])

    # PDF Processing Tab
    with tab1:
        st.header("Upload PDF")
        uploaded_file = st.file_uploader("Choose a PDF file", type="pdf")

        if uploaded_file:
            # Extract text from PDF
            text = extract_text_from_pdf(uploaded_file)

            # Extract metadata using Claude
            with st.spinner("Extracting metadata..."):
                metadata = extract_metadata_with_claude(claude, text)

                # Classify merchant
                if "merchant_name" in metadata:
                    with st.spinner("Classifying merchant..."):
                        merchant_result = merchant_classifier.classify_merchant(
                            metadata["merchant_name"],
                            claude,
                            languages=["en", "zh", "my"]  # Add more languages as needed
                        )

                        # Update metadata with merchant details
                        metadata["merchant_id"] = merchant_result["merchant_id"]
                        metadata["merchant_name"] = merchant_result["canonical_name"]
                        metadata["merchant_synonyms"] = merchant_classifier.get_all_synonyms(
                            merchant_result["canonical_name"]
                        )

            # Display extracted metadata
            st.subheader("Extracted Metadata")
            st.json(metadata)

            # Prepare document for MongoDB
            doc = {
                **metadata,
                "processed_date": datetime.utcnow(),
                "source_filename": uploaded_file.name,
                "raw_text": text
            }

            # Display MongoDB document
            st.subheader("MongoDB Document")
            st.json(doc)

            # Insert into MongoDB
            if st.button("Save to Database"):
                with st.spinner("Saving to database..."):
                    result = db.documents.insert_one(doc)
                    st.success(f"Document saved with ID: {result.inserted_id}")

    # Query Database Tab
    with tab2:
        st.header("Query Database")

        # Debug section
        with st.expander("🔍 Debug: View Database Contents"):
            col1, col2 = st.columns(2)

            with col1:
                st.subheader("Documents")
                docs = list(db.documents.find().limit(5))
                if docs:
                    for doc in docs:
                        doc["_id"] = str(doc["_id"])
                        if "merchant_id" in doc:
                            doc["merchant_id"] = str(doc["merchant_id"])
                        st.json(doc)
                else:
                    st.info("No documents found")

            with col2:
                st.subheader("Merchants")
                merchants = list(db.merchants.find().limit(10))
                if merchants:
                    for merchant in merchants:
                        merchant["_id"] = str(merchant["_id"])
                        st.json(merchant)
                else:
                    st.info("No merchants found")

        query = st.text_area("Enter your query in natural language",
                           "How much did I spend on Grab Singapore")

        if st.button("Run Query"):
            with st.spinner("Processing query..."):
                # Convert natural language to MongoDB query
                mongo_query = process_natural_language_query(claude, query)

                # Display MongoDB query
                st.subheader("MongoDB Query")
                st.code(mongo_query, language="json")

                # Execute query
                try:
                    pipeline = json.loads(mongo_query)

                    # Security: Validate pipeline before execution
                    validate_pipeline(pipeline)

                    results = list(db.documents.aggregate(pipeline))

                    # Display results
                    st.subheader(f"Results ({len(results)} documents)")
                    for result in results:
                        # Convert ObjectId to string for display
                        result["_id"] = str(result["_id"])
                        if "merchant_id" in result:
                            result["merchant_id"] = str(result["merchant_id"])
                        st.json(result)

                except PipelineValidationError as e:
                    st.error(f"Security validation failed: {str(e)}")
                except Exception as e:
                    st.error(f"Error executing query: {str(e)}")

if __name__ == "__main__":
    main()