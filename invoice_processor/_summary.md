A [Streamlit](https://streamlit.io/) application leverages [Claude's vision API](https://docs.anthropic.com/en/docs/build-with-claude/vision) to directly process PDF invoices and receipts without text extraction, using structured outputs to guarantee valid JSON responses. The system employs a sophisticated merchant classification pipeline that combines vector embeddings (via paraphrase-multilingual-mpnet-base-v2), MongoDB Atlas Vector Search, and LLM verification to automatically identify merchants across 50+ languages and name variations. Users can upload PDFs for automatic metadata extraction and merchant classification, then query their transaction data using natural language that gets converted to MongoDB aggregation pipelines.

**Key Technical Features:**
- Direct PDF vision processing preserves complex layouts and formatting
- Multilingual merchant matching with 0.85+ similarity threshold for automatic classification
- Vector search with 768-dimensional embeddings stored in MongoDB Atlas
- Natural language querying with real-time MongoDB pipeline generation
- Automatic synonym learning that improves merchant recognition over time