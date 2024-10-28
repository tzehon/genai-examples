# PDF Invoice Processor with Merchant Classification

A Streamlit application that processes PDF invoices/receipts, automatically classifies merchants using vector similarity and LLM verification, and provides natural language querying capabilities.

## Features

- PDF text extraction
- Automatic merchant classification
- Invoice/receipt metadata extraction
- Natural language querying
- Vector similarity search
- Multi-language support (English, Chinese)

## Technical Architecture

### Components

1. **MultilingualMerchantClassifier**
   - Uses SentenceTransformer for vector embeddings
   - MongoDB Atlas Vector Search for similarity matching
   - Claude for merchant verification and synonym detection

   #### Why paraphrase-multilingual-mpnet-base-v2?
   - **Superior Multilingual Performance**: Specifically trained on 50+ languages including English, Chinese, and other Asian languages

   - **Paraphrase Optimization**: Trained to recognize semantic similarity even with different phrasings, crucial for merchant name variations

   - **MPNet Architecture**: Combines benefits of BERT and XLNet with position-aware attention, leading to better semantic understanding

   - **Benchmarks**:
     - Higher performance on multilingual semantic similarity tasks compared to alternatives
     - Strong cross-lingual transfer: Can understand semantic similarity between different languages without specific training (e.g., can match "Hong Kong Restaurant" with "香港餐厅" even though it wasn't explicitly trained on these pairs)
     - Compact 768-dimensional embeddings balancing performance and efficiency
     
   - **Alternatives Considered**:
     - `all-MiniLM-L6-v2`: Faster but less accurate for multilingual content
     - `all-mpnet-base-v2`: Good performance but weaker on non-English text
     - `multilingual-e5-large`: Larger model with higher resource requirements

2. **PDF Processor**
   - PyMuPDF for text extraction
   - Claude for metadata extraction
   - Structured data parsing

3. **Query Interface**
   - Natural language to MongoDB query conversion
   - Cross-collection aggregation support
   - Real-time result display

## Setup Instructions

### 1. Environment Setup

```bash
# Create virtual environment
python -m venv .venv

# Activate environment
source .venv/bin/activate  # Unix/MacOS
.venv\Scripts\activate    # Windows

# Install dependencies
pip install -r requirements.txt
```

### 2. MongoDB Atlas Configuration

1. Create a MongoDB Atlas cluster
2. Enable Vector Search
3. Create the following indexes:
   ```javascript
   // Merchants collection
   db.merchants.createIndex({"canonical_name": 1}, {unique: true})
   db.merchants.createIndex({"synonyms": 1})

   // Documents collection
   db.documents.createIndex({"merchant_id": 1})
   db.documents.createIndex({"processed_date": 1})
   db.documents.createIndex({"merchant_name": 1})
   ```

### 3. Secrets Configuration

1. Rename `.streamlit/secrets_template.toml` to `.streamlit/secrets.toml`
2. Fill in your credentials:

```toml
# MongoDB Configuration
mongodb_uri = "mongodb+srv://<username>:<password>@<cluster>.mongodb.net/"
# Replace:
# - <username> with your MongoDB username
# - <password> with your MongoDB password
# - <cluster> with your cluster address
database_name = "your_database_name"

# Anthropic API Configuration
anthropic_api_key = "your_anthropic_api_key"
# Get your API key from: https://console.anthropic.com/account/keys
```

## Algorithm Flows

### 1. Merchant Classification Flow

```mermaid
graph TD
    %% Annotations first so they appear behind
    ann1[/"Using: paraphrase-multilingual-mpnet-base-v2<br>Output: 768-dimensional vector"/]
    ann2[/"Using: MongoDB Atlas Vector Search<br>Metric: Euclidean Distance"/]
    ann3[/"Using: claude-3-5-sonnet-20241022"/]

    subgraph InitialProcessing["Initial Processing"]
        A[New Merchant Name] --> B[Vector Embedding]
    end

    subgraph VectorSearch["MongoDB Atlas Vector Search"]
        B --> C{Exact Synonym Match?}
        C -->|No| E[Vector Similarity Search]
        E --> F{Similarity > 0.85?}
    end

    C -->|Yes| D[Return Existing Merchant]

    F -->|Yes| G[Add as Synonym]
    G --> H[Return Existing Merchant]

    subgraph LLMProcessing["Claude LLM Processing"]
        F -->|No| I[LLM Verification]
        I --> J{Is Synonym?}
    end

    J -->|Yes| K[Add as Synonym]
    K --> L[Return Existing Merchant]
    J -->|No| M[Create New Merchant]

    %% Connect annotations with transparent edges
    ann1 ~~~ B
    ann2 ~~~ E
    ann3 ~~~ I

    classDef initial fill:#13773D,stroke:#2ecc71,color:#fff
    classDef vector fill:#1B4B72,stroke:#4a90e2,color:#fff
    classDef llm fill:#5B2D66,stroke:#9b51e0,color:#fff
    classDef default color:#fff
    classDef annotation fill:#fff,stroke:#666,color:#333

    class InitialProcessing initial
    class VectorSearch vector
    class LLMProcessing llm
    class ann1,ann2,ann3 annotation
```

### 2. Query Processing Flow

```mermaid
graph TD
    %% Annotations first so they appear behind
    ann1[/"Using: claude-3-5-sonnet-20241022<br>Converts natural language to MongoDB query"/]
    ann2[/"Using: MongoDB Atlas<br>Executes aggregation pipeline"/]

    subgraph NLProcessing["Natural Language Processing"]
        A[Natural Language Query] --> B[Query Analysis]
        B --> C[Generate MongoDB Pipeline]
    end

    subgraph QueryProcessing["MongoDB Query Processing"]
        C --> D[Join Collections]
        D --> E[Apply Filters]
        E --> F[Aggregate Results]
    end

    subgraph ResultsProcessing["Results Processing"]
        F --> G[Format Results]
        G --> H[Display in UI]
    end

    %% Connect annotations with transparent edges
    ann1 ~~~ B
    ann2 ~~~ D

    classDef nlp fill:#13773D,stroke:#2ecc71,color:#fff
    classDef query fill:#1B4B72,stroke:#4a90e2,color:#fff
    classDef results fill:#5B2D66,stroke:#9b51e0,color:#fff
    classDef default color:#fff
    classDef annotation fill:#fff,stroke:#666,color:#333

    class NLProcessing nlp
    class QueryProcessing query
    class ResultsProcessing results
    class ann1,ann2 annotation

    %% Example query path
    H -.- I["Example:<br>Query: Show me all Grab receipts from last month<br>Pipeline: $lookup merchants → $match date → $group total"]
```

## Data Storage

### Merchant Storage
```javascript
{
  canonical_name: "Merchant Name",
  synonyms: ["Variation 1", "Variation 2"],
  merchant_embedding: [...],  // 768-dimensional vector
  metadata: {
    first_seen: ISODate("..."),
    last_updated: ISODate("..."),
    source: "pdf_extraction",
    languages: ["en", "zh"]
  }
}
```

### Document Storage
```javascript
{
  merchant_id: ObjectId("..."),
  merchant_name: "Canonical Merchant Name",
  date: ISODate("..."),
  total_amount: 123.45,
  category: "receipt",
  currency: "SGD",
  payment_method: "credit_card",
  items: [
    { name: "Item 1", price: 50.00 },
    { name: "Item 2", price: 73.45 }
  ],
  processed_date: ISODate("..."),
  source_filename: "invoice.pdf",
  raw_text: "Original PDF text..."
}
```

## Usage Workflow

1. **Document Upload**
   - Upload PDF invoice/receipt
   - System extracts text and metadata
   - Classifies merchant automatically

2. **Merchant Classification**
   - Automatic detection of new/existing merchants
   - Builds synonym database over time
   - Handles multiple languages and variations
   - Each classified name either:
     - Adds new synonym to existing merchant
     - Creates new merchant entry

3. **Data Storage**
   - Merchant data stored in merchants collection
   - Document data stored in documents collection
   - Cross-referenced using merchant_id

4. **Querying**
   - Use natural language queries
   - Examples:
     - "Show me all Grab receipts from last month"
     - "Calculate total spending by merchant"
     - "Find all transactions over $100"
   - Queries automatically handle:
     - Merchant variations/synonyms
     - Date ranges
     - Amount comparisons
     - Category filtering