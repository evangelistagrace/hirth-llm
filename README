## Hirth RAG

## Overview
Hirth RAG uses semantic search and keyword matching to retrieve relevant information from a knowledge base. It is designed to assist users in finding answers to their questions by leveraging a combination of natural language processing and information retrieval techniques.

## Starting the Application
### Backend
```
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Index your source documents (run once)
python -c "from ingestion import ingest_directory; from pathlib import Path; print(ingest_directory(Path('../sources')))"

# Start the API server
uvicorn main:app --reload --port 8000
```

### Frontend
```
cd frontend
npm install
npm run dev
```

