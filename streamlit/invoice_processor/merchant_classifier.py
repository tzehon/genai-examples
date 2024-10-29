from typing import Dict, List, Optional, Union, Any
from datetime import datetime
from pymongo import MongoClient
from pymongo.operations import SearchIndexModel
from sentence_transformers import SentenceTransformer
import numpy as np
import json
import time

class MultilingualMerchantClassifier:
    def __init__(
        self,
        mongodb_uri: str,
        db_name: str = "cathay",
        model_name: str = "paraphrase-multilingual-mpnet-base-v2"
    ):
        """
        Initialize with MongoDB Atlas connection and multilingual model.
        Using mpnet-base-v2 for superior multilingual support including Chinese.
        """
        self.client = MongoClient(mongodb_uri)
        self.db = self.client[db_name]
        # Separate collections for merchants and documents
        self.merchants = self.db.merchants
        self.documents = self.db.documents

        # Load the model with retries
        max_retries = 3
        for attempt in range(max_retries):
            try:
                print(f"Loading model {model_name}, attempt {attempt + 1}")
                self.model = SentenceTransformer(model_name)
                print("Model loaded successfully")
                break
            except Exception as e:
                print(f"Error loading model (attempt {attempt + 1}): {e}")
                if attempt < max_retries - 1:
                    time.sleep(1)  # Wait before retrying
                else:
                    raise

        # Setup indexes
        self._setup_indexes()

    def _setup_indexes(self):
        """Setup MongoDB Atlas Vector Search index and other indexes."""
        search_index_model = SearchIndexModel(
            definition = {
                "fields": [
                    {
                        "type": "vector",
                        "path": "merchant_embedding",
                        "similarity": "cosine",
                        "numDimensions": self.model.get_sentence_embedding_dimension(),
                    }
                ]
            },
            name="merchant_vector_index",
            type="vectorSearch",
        )

        try:
            # Check if the search index exists
            existing_indexes = self.merchants.list_search_indexes()
            vector_index_exists = any(idx["name"] == "merchant_vector_index" for idx in existing_indexes)

            if not vector_index_exists:
                self.merchants.create_search_index(search_index_model)
                print("Vector search index created successfully")

            # Create regular indexes for merchants collection
            self.merchants.create_index("canonical_name", unique=True)
            self.merchants.create_index("synonyms")

            # Create indexes for documents collection
            self.documents.create_index("merchant_id")  # Reference to merchant
            self.documents.create_index("processed_date")
            self.documents.create_index("merchant_name")  # For text search
            print("All indexes created successfully")

        except Exception as e:
            print(f"Error creating indexes: {e}")

    def find_closest_merchant(
        self,
        name: str,
        threshold: float = 0.85
    ) -> tuple[Optional[Dict], float]:
        """Find the most similar existing merchant using vector search and synonym lookup."""
        # 1. First check exact match in synonyms
        exact_match = self.merchants.find_one({
            "synonyms": name
        })
        if exact_match:
            return exact_match, 1.0  # Perfect match score

        # 2. If no exact synonym match, do vector search
        query_vector = self.model.encode(name).tolist()

        pipeline = [
            {
                "$vectorSearch": {
                    "index": "merchant_vector_index",
                    "path": "merchant_embedding",
                    "queryVector": query_vector,
                    "numCandidates": 100,
                    "limit": 5  # Increased to check more candidates
                }
            },
            # Add a stage to unwind synonyms for vector comparison
            {
                "$project": {
                    "_id": 1,
                    "canonical_name": 1,
                    "synonyms": 1,
                    "merchant_embedding": 1,
                    "score": { "$meta": "vectorSearchScore" }
                }
            },
            {
                "$unwind": {
                    "path": "$synonyms",
                    "preserveNullAndEmptyArrays": True  # Changed from true to True
                }
            },
            # Group back to get best score whether from canonical or synonym
            {
                "$group": {
                    "_id": "$_id",
                    "canonical_name": { "$first": "$canonical_name" },
                    "synonyms": { "$push": "$synonyms" },
                    "score": { "$first": "$score" }
                }
            },
            # Sort by similarity score
            {
                "$sort": {
                    "score": -1
                }
            },
            {
                "$limit": 1
            }
        ]

        results = list(self.merchants.aggregate(pipeline))

        if not results:
            return None, 0.0

        best_match = results[0]
        similarity = best_match["score"]

        return best_match, similarity

    def classify_merchant(
        self,
        extracted_name: str,
        llm_client,
        languages: Optional[List[str]] = None
    ) -> Dict:
        """
        Classify a merchant name using vector similarity and LLM verification.
        Returns merchant details including ID for document reference.
        """
        closest_match, similarity = self.find_closest_merchant(extracted_name)

        if similarity > 0.85:  # High confidence match
            # Add to synonyms array if it's a high confidence match
            merchant_id = closest_match["_id"]
            self.merchants.update_one(
                {"_id": merchant_id},
                {
                    "$addToSet": {"synonyms": extracted_name},
                    "$set": {
                        "last_updated": datetime.utcnow()
                    }
                }
            )

            return {
                "merchant_id": merchant_id,
                "canonical_name": closest_match["canonical_name"],
                "is_synonym": True,
                "confidence": similarity
            }

        language_context = ""
        if languages:
            language_context = f"Consider that the names might be in any of these languages: {', '.join(languages)}. "

        prompt = f"""Analyze if '{extracted_name}' is a synonym or variation of '{closest_match["canonical_name"] if closest_match else "None"}' if one exists.
        {language_context}Consider common variations, misspellings, and business name patterns.
        Return JSON with these fields:
        - is_new_merchant: boolean
        - canonical_name: string (either existing or suggested new name)
        - confidence: float (0-1)
        - reasoning: string
        """

        message = llm_client.messages.create(
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

        response_text = message.content[0].text
        analysis = json.loads(response_text)

        if not analysis["is_new_merchant"] and closest_match:
            # Add as synonym if it doesn't exist
            merchant_id = closest_match["_id"]
            canonical_name = analysis["canonical_name"]

            self.merchants.update_one(
                {"_id": merchant_id},
                {
                    "$addToSet": {"synonyms": extracted_name},
                    "$set": {
                        "merchant_embedding": self.model.encode(extracted_name).tolist(),
                        "last_updated": datetime.utcnow()
                    }
                }
            )

            return {
                "merchant_id": merchant_id,
                "canonical_name": canonical_name,
                "is_synonym": True,
                "confidence": analysis["confidence"]
            }
        else:
            # Add new merchant
            embedding = self.model.encode(extracted_name).tolist()
            result = self.merchants.insert_one({
                "canonical_name": extracted_name,
                "synonyms": [],
                "merchant_embedding": embedding,
                "metadata": {
                    "first_seen": datetime.utcnow(),
                    "last_updated": datetime.utcnow(),
                    "source": "pdf_extraction",
                    "languages": languages
                }
            })

            return {
                "merchant_id": result.inserted_id,
                "canonical_name": extracted_name,
                "is_synonym": False,
                "confidence": analysis["confidence"]
            }

    def get_merchant_details(self, merchant_id: str) -> Optional[Dict]:
        """Get full merchant details by ID."""
        return self.merchants.find_one({"_id": merchant_id})

    def get_all_synonyms(self, canonical_name: str) -> List[str]:
        """Get all synonyms for a canonical merchant name."""
        merchant = self.merchants.find_one(
            {"canonical_name": canonical_name},
            {"synonyms": 1}
        )
        return merchant["synonyms"] if merchant else []