A [Streamlit](https://streamlit.io) application leverages Claude's vision capabilities and vector similarity search to automatically process PDF invoices, classify merchants across multiple languages, and enable natural language database queries. The system uses the `paraphrase-multilingual-mpnet-base-v2` model to generate 768-dimensional embeddings for merchant names, matching them against existing entries in [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) using vector search with a 0.85 cosine similarity threshold. When uncertainty exists, Claude Sonnet 4.5 provides LLM verification, building a synonym database over time that handles variations like "Grab Singapore Pte Ltd" versus "Grab SG" and cross-language matching (e.g., "香港餐厅" with "Hong Kong Restaurant").

**Key Technical Features:**
- Direct PDF analysis via Claude Vision API preserving layout and formatting (no intermediate text extraction)
- Structured outputs using Claude's tool use feature for guaranteed valid JSON responses
- Three-tier merchant classification: exact synonym match → vector similarity (>0.85) → LLM verification
- Natural language to MongoDB aggregation pipeline conversion with query explanations
- Free tier compatible: MongoDB Atlas M0 (512MB) and pay-per-use Anthropic API (~$0.02-0.10 per document)