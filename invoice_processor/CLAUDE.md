# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Setup & Commands

```bash
# Setup
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Configure
cp .streamlit/secrets_template.toml .streamlit/secrets.toml
# Edit secrets.toml with MongoDB URI and Anthropic API key

# Run
streamlit run app.py
```

## Architecture

Streamlit app for PDF invoice processing with intelligent merchant classification.

### Components
1. **MultilingualMerchantClassifier** (`merchant_classifier.py`)
   - `paraphrase-multilingual-mpnet-base-v2` for 768-dim vector embeddings
   - MongoDB Atlas Vector Search for similarity matching (0.85 threshold)
   - Claude for merchant verification when similarity is uncertain

2. **PDF Processor** (`app.py`)
   - PyMuPDF for text extraction
   - Claude for metadata extraction (merchant, date, amount, items)

3. **Query Interface** (`app.py`)
   - Natural language to MongoDB aggregation pipeline conversion
   - Cross-collection joins between merchants and documents

### Merchant Classification Flow
1. Extract merchant name from PDF
2. Check exact synonym match in existing merchants
3. Vector similarity search (>0.85 = auto-match)
4. If uncertain, Claude verifies if it's a synonym
5. Either add as synonym to existing merchant or create new

### Data Model
- `merchants` collection: `canonical_name`, `synonyms[]`, `merchant_embedding`
- `documents` collection: `merchant_id`, `date`, `total_amount`, `items[]`, `raw_text`

### Requirements
- MongoDB Atlas with Vector Search enabled
- Vector search index named `merchant_vector_index` on `merchants.merchant_embedding`
- Anthropic API key for Claude
