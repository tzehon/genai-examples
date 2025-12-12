import streamlit as st
import anthropic
import pymongo
import base64
from typing import Any, Dict
import json
from datetime import datetime
from sentence_transformers import SentenceTransformer
from bson import ObjectId
from merchant_classifier import MultilingualMerchantClassifier


# Tool definitions for Claude structured outputs
INVOICE_EXTRACTION_TOOL = {
    "name": "extract_invoice_metadata",
    "description": "Extract structured metadata from an invoice or receipt document",
    "input_schema": {
        "type": "object",
        "properties": {
            "merchant_name": {
                "type": "string",
                "description": "The business or merchant name"
            },
            "date": {
                "type": "string",
                "description": "The transaction or document date in ISO 8601 format (YYYY-MM-DD)"
            },
            "total_amount": {
                "type": "number",
                "description": "The total amount of the transaction"
            },
            "currency": {
                "type": "string",
                "description": "The currency code (e.g., USD, SGD, EUR)"
            },
            "category": {
                "type": "string",
                "enum": ["receipt", "invoice", "statement", "bill", "other"],
                "description": "The type of document"
            },
            "payment_method": {
                "type": "string",
                "description": "The payment method if mentioned (e.g., credit_card, cash, debit)"
            },
            "items": {
                "type": "array",
                "description": "Array of items/services mentioned with prices",
                "items": {
                    "type": "object",
                    "properties": {
                        "description": {"type": "string"},
                        "quantity": {"type": "number"},
                        "unit_price": {"type": "number"},
                        "total": {"type": "number"}
                    },
                    "required": ["description"]
                }
            }
        },
        "required": ["merchant_name", "total_amount", "currency"]
    }
}

MONGODB_PIPELINE_TOOL = {
    "name": "generate_mongodb_pipeline",
    "description": "Generate a MongoDB aggregation pipeline from a natural language query",
    "input_schema": {
        "type": "object",
        "properties": {
            "pipeline": {
                "type": "array",
                "description": "MongoDB aggregation pipeline stages",
                "items": {"type": "object"}
            },
            "explanation": {
                "type": "string",
                "description": "Brief explanation of what the pipeline does"
            }
        },
        "required": ["pipeline"]
    }
}


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

def extract_metadata_with_claude(
    claude: anthropic.Client,
    pdf_bytes: bytes
) -> Dict[str, Any]:
    """
    Extract metadata from PDF using Claude's vision capability and structured outputs.

    Uses PDF vision to preserve document layout (tables, formatting) and tool use
    for guaranteed valid JSON output matching the schema.
    """
    # Encode PDF as base64 for vision API
    pdf_base64 = base64.standard_b64encode(pdf_bytes).decode("utf-8")

    message = claude.messages.create(
        model="claude-sonnet-4-5-20250929",
        max_tokens=1024,
        tools=[INVOICE_EXTRACTION_TOOL],
        tool_choice={"type": "tool", "name": "extract_invoice_metadata"},
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "document",
                        "source": {
                            "type": "base64",
                            "media_type": "application/pdf",
                            "data": pdf_base64
                        }
                    },
                    {
                        "type": "text",
                        "text": "Extract all invoice/receipt metadata from this document. Include merchant name, date, amounts, items, and payment details."
                    }
                ]
            }
        ]
    )

    # With tool_choice forcing the tool, the response is guaranteed to be
    # valid JSON matching our schema - no parsing/cleanup needed
    for block in message.content:
        if block.type == "tool_use":
            return block.input

    raise ValueError("Claude did not return tool use response")

def process_natural_language_query(
    claude: anthropic.Client,
    query: str
) -> dict:
    """
    Convert natural language query to MongoDB aggregation pipeline using structured outputs.

    Returns a dict with 'pipeline' (list) and optional 'explanation' (str).
    """
    system_prompt = """You are a MongoDB query generator. Convert natural language queries into MongoDB aggregation pipelines.

CRITICAL: When a merchant name is mentioned in the query, use the EXACT merchant name as it appears.

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

For merchant queries, use $lookup with let/expr pattern to match by canonical_name or synonyms.

Important:
1. Use EXACT merchant name from the query - do not abbreviate or modify it
2. Use exact operator syntax: "$eq", "$ne", "$in", etc.
3. For string comparison use exact match, not regex
4. The $lookup must use let/expr pattern for merchant matching"""

    message = claude.messages.create(
        model="claude-sonnet-4-5-20250929",
        max_tokens=1024,
        system=system_prompt,
        tools=[MONGODB_PIPELINE_TOOL],
        tool_choice={"type": "tool", "name": "generate_mongodb_pipeline"},
        messages=[
            {
                "role": "user",
                "content": f"Convert this query to a MongoDB aggregation pipeline: {query}"
            }
        ]
    )

    # With tool_choice forcing the tool, response is guaranteed valid JSON
    for block in message.content:
        if block.type == "tool_use":
            return block.input

    raise ValueError("Claude did not return tool use response")

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
            # Get PDF bytes for vision API
            pdf_bytes = uploaded_file.getvalue()

            # Extract metadata using Claude vision + structured outputs
            with st.spinner("Extracting metadata with Claude Vision..."):
                metadata = extract_metadata_with_claude(claude, pdf_bytes)

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
                "source_filename": uploaded_file.name
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
                # Convert natural language to MongoDB query using structured outputs
                query_result = process_natural_language_query(claude, query)
                pipeline = query_result["pipeline"]

                # Display MongoDB query
                st.subheader("MongoDB Query")
                st.code(json.dumps(pipeline, indent=2), language="json")

                # Show explanation if provided
                if "explanation" in query_result:
                    st.info(f"**Query explanation:** {query_result['explanation']}")

                # Execute query
                try:
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