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
   - Claude Sonnet 4.5 for merchant verification and synonym detection

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
   - Claude Sonnet 4.5 for metadata extraction
   - Structured data parsing

3. **Query Interface**
   - Natural language to MongoDB query conversion
   - Cross-collection aggregation support
   - Real-time result display

## Prerequisites

- Python 3.9 to 3.13 (Python 3.14+ may require additional build tools)
- MongoDB Atlas account (free tier available)
- Anthropic API key (get from https://console.anthropic.com/account/keys)

### Additional Requirements for Python 3.14+

If using Python 3.14 or newer, you'll need to install build tools as prebuilt wheels may not be available:

**macOS:**
```bash
brew install cmake
```

**Linux:**
```bash
sudo apt-get install cmake build-essential  # Ubuntu/Debian
sudo yum install cmake gcc-c++              # RedHat/CentOS
```

**Windows:**
- Install [CMake](https://cmake.org/download/)
- Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/)

**Recommended:** Use Python 3.11-3.13 to avoid build requirements and get faster installation with prebuilt wheels.

## Complete Setup Guide

### Step 1: Clone and Navigate to Project

```bash
cd streamlit/invoice_processor
```

### Step 2: Environment Setup

```bash
# Create virtual environment
python3 -m venv .venv

# Activate environment
source .venv/bin/activate  # Unix/MacOS
.venv\Scripts\activate    # Windows

# Install dependencies
pip install -r requirements.txt
```

**Note**: First run will download the `paraphrase-multilingual-mpnet-base-v2` model (~420MB). This is normal and only happens once.

### Step 3: MongoDB Atlas Configuration

#### 3.1 Create a MongoDB Atlas Cluster

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register)
2. Sign up for a free account (no credit card required)
3. Create a new cluster:
   - Choose **FREE** shared tier (M0)
   - Select a cloud provider and region
   - Click **Create Cluster**

#### 3.2 Create Database User

1. In Atlas, go to **Database Access** (left sidebar under Security)
2. Click **Add New Database User**
3. Choose **Password** authentication
4. Set username and password (save these - you'll need them)
5. Set **Database User Privileges** to "Read and write to any database"
6. Click **Add User**

#### 3.3 Configure Network Access

1. Go to **Network Access** (left sidebar under Security)
2. Click **Add IP Address**
3. Click **Allow Access from Anywhere** (or add your specific IP)
4. Click **Confirm**

#### 3.4 Get Connection String

1. Go to **Database** (left sidebar)
2. Click **Connect** on your cluster
3. Select **Connect your application**
4. Copy the connection string (looks like `mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/`)
5. Replace `<username>` and `<password>` with your database user credentials
6. Save this connection string - you'll need it for configuration

#### 3.5 Enable Vector Search

1. Go to **Database** → Click on your cluster name
2. Click the **Search** tab
3. Click **Create Search Index**
4. Choose **JSON Editor**
5. Select your database and the `merchants` collection
6. Use the following index definition:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "merchant_embedding",
      "similarity": "cosine",
      "numDimensions": 768
    }
  ]
}
```

7. Name it `merchant_vector_index`
8. Click **Create Search Index**
9. Wait for the index status to become **Active** (takes 1-2 minutes)

**Important**: The application will automatically create the regular indexes when it first runs.

### Step 4: Get Anthropic API Key

1. Go to [Anthropic Console](https://console.anthropic.com/account/keys)
2. Sign in or create an account
3. Click **Create Key**
4. Copy the API key (starts with `sk-ant-`)
5. Save this key securely - you won't be able to see it again

### Step 5: Configure Application Secrets

1. Copy the template file:
```bash
cp .streamlit/secrets_template.toml .streamlit/secrets.toml
```

2. Edit `.streamlit/secrets.toml` with your credentials:

```toml
# MongoDB Configuration
mongodb_uri = "mongodb+srv://yourusername:yourpassword@cluster0.xxxxx.mongodb.net/"
database_name = "invoice_processor"

# Anthropic API Configuration
anthropic_api_key = "sk-ant-api03-your-actual-key-here"
```

**Replace**:
- `mongodb_uri`: Use the connection string from Step 3.4
- `database_name`: Choose any name (e.g., "invoice_processor")
- `anthropic_api_key`: Use your API key from Step 4

### Step 6: Run the Application

```bash
streamlit run app.py
```

The application will:
1. Open automatically in your browser at `http://localhost:8501`
2. Connect to MongoDB Atlas
3. Load the multilingual model (first run only)
4. Create necessary database indexes automatically

### Step 7: Verify Setup

1. **Check MongoDB Connection**: The app should load without errors
2. **Test PDF Upload**:
   - Go to the "PDF Processing" tab
   - Upload a sample invoice/receipt PDF
   - Verify metadata extraction works
3. **Test Merchant Classification**: Check that merchant is automatically classified
4. **Test Querying**:
   - Go to the "Query Database" tab
   - Try a query like "Show all transactions"

## Usage Workflow

### 1. Upload Documents

1. Click the **PDF Processing** tab
2. Click **Browse files** and select an invoice/receipt PDF
3. The system will:
   - Extract text from the PDF
   - Use Claude to extract metadata (merchant, date, amount, items)
   - Automatically classify the merchant using:
     - Exact synonym matching
     - Vector similarity search (>0.85 threshold)
     - LLM verification for uncertain matches
4. Review the extracted data
5. Click **Save to Database** to store the document

### 2. Query Your Data

1. Click the **Query Database** tab
2. Enter a natural language query, such as:
   - "How much did I spend on Grab?"
   - "Show me all receipts from last month"
   - "Calculate total spending by merchant"
   - "Find all transactions over $100"
3. Click **Run Query**
4. View the generated MongoDB query and results

### 3. Merchant Classification Intelligence

The system learns over time:
- First time seeing "Grab Singapore Pte Ltd" → Creates new merchant
- Next time seeing "Grab SG" → Automatically recognizes as same merchant
- Adds variations as synonyms for future matching
- Works across languages (e.g., matches "香港餐厅" with "Hong Kong Restaurant")

## Algorithm Flows

### 1. Merchant Classification Flow

```mermaid
graph TD
    %% Annotations first so they appear behind
    ann1[/"Using: paraphrase-multilingual-mpnet-base-v2<br>Output: 768-dimensional vector"/]
    ann2[/"Using: MongoDB Atlas Vector Search<br>Metric: Cosine Distance"/]
    ann3[/"Using: claude-sonnet-4-5-20250929"/]

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
    ann1[/"Using: claude-sonnet-4-5-20250929<br>Converts natural language to MongoDB query"/]
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

## Troubleshooting

### Connection Issues

**Problem**: `pymongo.errors.ServerSelectionTimeoutError`
- **Cause**: Cannot connect to MongoDB Atlas
- **Solutions**:
  1. Check your internet connection
  2. Verify the MongoDB URI in `.streamlit/secrets.toml` is correct
  3. Ensure your IP is whitelisted in MongoDB Atlas Network Access
  4. Try "Allow Access from Anywhere" in Network Access settings

**Problem**: `Authentication failed`
- **Cause**: Invalid MongoDB credentials
- **Solutions**:
  1. Verify username and password in the connection string
  2. Ensure special characters in password are URL-encoded
  3. Check database user has correct privileges

### API Key Issues

**Problem**: `anthropic.AuthenticationError`
- **Cause**: Invalid or missing Anthropic API key
- **Solutions**:
  1. Verify API key in `.streamlit/secrets.toml` starts with `sk-ant-`
  2. Check key is active at https://console.anthropic.com/account/keys
  3. Ensure no extra spaces or quotes around the key

**Problem**: `Rate limit exceeded`
- **Cause**: Too many API requests
- **Solutions**:
  1. Wait a few minutes before trying again
  2. Check your Anthropic usage limits
  3. Consider upgrading your API plan for higher limits

### Vector Search Issues

**Problem**: Vector search returns no results
- **Cause**: Vector search index not created or not active
- **Solutions**:
  1. Go to MongoDB Atlas → Database → Search tab
  2. Verify `merchant_vector_index` exists and is **Active**
  3. If missing, follow Step 3.5 in setup guide
  4. Wait 1-2 minutes for index to become active

**Problem**: `Index not found: merchant_vector_index`
- **Cause**: Vector search index doesn't exist
- **Solution**: Create the index following Step 3.5 in the setup guide

### Model Download Issues

**Problem**: First run is very slow or hangs
- **Cause**: Downloading the 420MB multilingual model
- **Solutions**:
  1. This is normal - wait for download to complete (5-10 minutes)
  2. Check your internet connection
  3. Model is cached after first download

**Problem**: `OSError: Can't load tokenizer`
- **Cause**: Model download was interrupted
- **Solutions**:
  1. Delete the model cache: `rm -rf ~/.cache/torch/sentence_transformers/`
  2. Restart the application to re-download

### PDF Processing Issues

**Problem**: PDF text extraction is gibberish
- **Cause**: PDF might be scanned image or have encoding issues
- **Solutions**:
  1. Try a different PDF
  2. Use PDFs with selectable text (not scanned images)
  3. Consider adding OCR support for scanned documents

**Problem**: Metadata extraction is incomplete
- **Cause**: Unclear or unusual invoice format
- **Solutions**:
  1. Check the raw text extraction looks correct
  2. Claude does its best but complex layouts may confuse it
  3. You can manually edit the extracted data before saving

### Query Issues

**Problem**: Query returns no results
- **Causes**: No matching documents or incorrect query
- **Solutions**:
  1. First upload some documents using the PDF Processing tab
  2. Try simpler queries like "Show all documents"
  3. Check the generated MongoDB query for errors
  4. Verify merchant names match what's in your database

**Problem**: `JSONDecodeError` when running queries
- **Cause**: Claude generated invalid JSON
- **Solutions**:
  1. Try rephrasing your query more clearly
  2. Check the generated query and fix JSON syntax manually
  3. Report the issue if it persists

### Installation Issues

**Problem**: `error: command 'cmake' failed: No such file or directory`
- **Cause**: Using Python 3.14+ which requires building pyarrow from source
- **Solutions**:
  1. **Recommended**: Use Python 3.11-3.13 instead:
     ```bash
     deactivate  # Exit current venv
     python3.13 -m venv .venv  # Or python3.12, python3.11
     source .venv/bin/activate
     pip install -r requirements.txt
     ```
  2. **Alternative**: Install cmake and rebuild:
     ```bash
     brew install cmake  # macOS
     pip install -r requirements.txt
     ```

**Problem**: `Building wheel for pyarrow failed`
- **Cause**: Missing build tools or incompatible Python version
- **Solutions**:
  1. Use Python 3.11-3.13 (has prebuilt wheels)
  2. Install cmake and build tools (see Prerequisites section)
  3. Try installing with conda instead: `conda install -c conda-forge pyarrow`

### General Issues

**Problem**: `.streamlit/secrets.toml` not found
- **Solution**: Copy the template: `cp .streamlit/secrets_template.toml .streamlit/secrets.toml`

**Problem**: Module not found errors
- **Cause**: Dependencies not installed
- **Solution**:
  1. Activate your virtual environment: `source .venv/bin/activate`
  2. Install dependencies: `pip install -r requirements.txt`

**Problem**: Application won't start
- **Solutions**:
  1. Check all prerequisites are met (Python 3.9-3.13, dependencies installed)
  2. Verify secrets.toml exists and has correct values
  3. Check terminal for specific error messages
  4. Try running in a fresh virtual environment with Python 3.11-3.13

## Technical Notes

- **Model**: Using `claude-sonnet-4-5-20250929` (latest as of 2025)
- **Vector Dimensions**: 768 (from paraphrase-multilingual-mpnet-base-v2)
- **Similarity Threshold**: 0.85 for automatic merchant matching
- **Supported Languages**: 50+ including English, Chinese, Spanish, French, German, etc.
- **Database**: MongoDB Atlas with Vector Search enabled
- **Collections**: `merchants` (canonical names + embeddings) and `documents` (transaction records)

## Cost Considerations

- **MongoDB Atlas**: Free M0 tier available (512MB storage, sufficient for thousands of documents)
- **Anthropic API**: Pay-per-use pricing
  - ~$3 per million input tokens
  - ~$15 per million output tokens
  - Typical invoice processing: $0.01-0.05 per document
  - Natural language queries: $0.001-0.01 per query
- **Model Download**: Free, one-time 420MB download

## Security Notes

- **Never commit** `.streamlit/secrets.toml` to version control
- `.streamlit/secrets.toml` is in `.gitignore` by default
- Use environment-specific secrets for production deployments
- Rotate API keys periodically
- Use MongoDB IP whitelisting when possible

## Support

For issues or questions:
1. Check this troubleshooting section first
2. Review MongoDB Atlas and Anthropic documentation
3. Ensure all setup steps were completed correctly
4. Check error messages carefully - they often indicate the exact problem