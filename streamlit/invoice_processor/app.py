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
        model="claude-3-5-sonnet-20241022",
        max_tokens=1000,
        temperature=0,
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ]
    )

    return json.loads(message.content[0].text)

def process_natural_language_query(
    claude: anthropic.Client,
    query: str
) -> str:
    """Convert natural language query to MongoDB query using Claude."""
    prompt = f"""Convert this natural language query into a MongoDB aggregation pipeline:
    "{query}"

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
    - canonical_name (string, e.g., "Grab", "M1")
    - synonyms (array of strings)

    Here's the exact format to use (this is a working example for Grab transactions):
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
                        {{ "$eq": ["$canonical_name", "Grab"] }},
                        {{ "$in": ["Grab", "$synonyms"] }}
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
    1. Use exact operator syntax: "$eq", "$ne", "$in", etc.
    2. Always use proper JSON formatting
    3. For string comparison use exact match, not regex
    4. The $lookup must use let/expr pattern as shown above

    Return only the valid JSON array for the MongoDB aggregation pipeline. No explanation.
    Format dates using ISODate() where needed."""

    message = claude.messages.create(
        model="claude-3-5-sonnet-20241022",
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
    response = message.content[0].text

    # Clean up any potential formatting issues
    response = response.strip()
    if response.startswith('```json'):
        response = response.split('```json')[1]
    if response.startswith('```'):
        response = response.split('```')[1]
    response = response.strip()

    return response

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
                            languages=["en", "zh"]  # Add more languages as needed
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
        query = st.text_area("Enter your query in natural language",
                           "How much did I spend on Grab")

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
                    results = list(db.documents.aggregate(pipeline))

                    # Display results
                    st.subheader(f"Results ({len(results)} documents)")
                    for result in results:
                        # Convert ObjectId to string for display
                        result["_id"] = str(result["_id"])
                        if "merchant_id" in result:
                            result["merchant_id"] = str(result["merchant_id"])
                        st.json(result)

                except Exception as e:
                    st.error(f"Error executing query: {str(e)}")

if __name__ == "__main__":
    main()