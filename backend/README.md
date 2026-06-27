# Hirth Knowledge RAG Backend

Production-style backend for an AI-powered two-stroke engine knowledge database.
The system is designed to ingest technical documents such as PDFs, manuals, CSV files, Excel sheets, and DOCX files, store document metadata, and later process them into chunks for retrieval-augmented generation.

## Project Goal

Knowledge about two-stroke engines is often fragmented across manuals, PDFs, spreadsheets, forums, and expert experience. This backend is the foundation for a structured RAG platform that can:

* Upload and manage technical documents
* Store document metadata in PostgreSQL
* Extract text from files using document parsers
* Generate chunks from extracted text
* Store embeddings in a vector database
* Retrieve relevant knowledge using semantic search
* Generate source-grounded answers using an LLM

## Current Implementation Status

Completed so far:

* Production-style FastAPI backend structure
* Versioned API routing using `/api/v1`
* Health check endpoint
* Docker Compose setup for PostgreSQL and Qdrant
* PostgreSQL connection configuration using environment variables
* Document upload endpoint
* File type validation
* File saving to local storage
* Document metadata persistence in PostgreSQL
* SQLAlchemy document model
* Repository layer for database access
* Basic automatic table creation during development
* Git branch setup and push workflow

Planned next:

* Document extraction using Docling and Pandas
* Chunk generation service
* Embedding generation
* Qdrant vector storage
* Retrieval endpoint
* RAG chat endpoint
* Source citation support
* Frontend integration

## Tech Stack

| Layer             | Technology                     |
| ----------------- | ------------------------------ |
| Backend Framework | FastAPI                        |
| Language          | Python                         |
| Metadata Database | PostgreSQL                     |
| ORM               | SQLAlchemy                     |
| Vector Database   | Qdrant                         |
| Document Parsing  | Docling                        |
| CSV/Excel Parsing | Pandas + openpyxl              |
| Embeddings        | intfloat/multilingual-e5-small |
| API Validation    | Pydantic                       |
| Containerization  | Docker + Docker Compose        |
| Testing           | Pytest                         |
| Version Control   | Git + GitHub                   |

## Folder Structure

```text
backend/
├── app/
│   ├── main.py
│   ├── core/
│   │   ├── config.py
│   │   ├── logging.py
│   │   └── exceptions.py
│   ├── api/
│   │   └── v1/
│   │       ├── api.py
│   │       └── endpoints/
│   │           ├── health.py
│   │           └── ingestion.py
│   ├── db/
│   │   ├── base.py
│   │   └── session.py
│   ├── models/
│   │   └── document.py
│   ├── repositories/
│   │   └── document_repository.py
│   ├── schemas/
│   │   └── document.py
│   ├── services/
│   ├── providers/
│   ├── utils/
│   │   └── file_utils.py
│   └── workers/
├── storage/
│   ├── uploads/
│   └── processed/
├── tests/
├── docker-compose.yml
├── requirements.txt
├── .env.example
├── .gitignore
└── README.md
```

## Architecture

```text
User uploads document
        ↓
FastAPI upload endpoint
        ↓
File validation
        ↓
Save file to storage/uploads
        ↓
Create document metadata record
        ↓
Store metadata in PostgreSQL
        ↓
Return document ID and status
```

Future RAG flow:

```text
Uploaded document
        ↓
Docling / Pandas extraction
        ↓
Chunking service
        ↓
Embedding model
        ↓
Qdrant vector database
        ↓
Semantic retrieval
        ↓
LLM answer generation
        ↓
Answer with source references
```

## API Endpoints

### Root Endpoint

```http
GET /
```

Example response:

```json
{
  "message": "Two-Stroke Knowledge RAG Backend",
  "docs": "/docs",
  "health": "/api/v1/health"
}
```

### Health Check

```http
GET /api/v1/health
```

Example response:

```json
{
  "status": "ok",
  "service": "rag-backend"
}
```

### Upload Document

```http
POST /api/v1/ingestion/upload
```

Supported file types:

```text
.pdf
.docx
.pptx
.txt
.csv
.xlsx
```

Example successful response:

```json
{
  "id": 1,
  "original_filename": "Simulation_Modelling.pdf",
  "stored_filename": "cd16744cc0694e65be7985569023e01d.pdf",
  "file_path": "storage\\uploads\\cd16744cc0694e65be7985569023e01d.pdf",
  "file_type": ".pdf",
  "file_size": 3351327,
  "status": "uploaded",
  "error_message": null,
  "created_at": "2026-06-27T08:29:20.889550",
  "updated_at": "2026-06-27T08:29:20.889550"
}
```

## Environment Variables

Create a `.env` file in the backend root directory.

Example:

```env
APP_NAME="Two-Stroke Knowledge RAG Backend"
APP_ENV="development"
API_V1_PREFIX="/api/v1"

POSTGRES_HOST=localhost
POSTGRES_PORT=5439
POSTGRES_DB=hirth_knowledge_db
POSTGRES_USER=hirth_user
POSTGRES_PASSWORD=hirth_password

QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_COLLECTION=engine_knowledge_chunks

EMBEDDING_MODEL_NAME=intfloat/multilingual-e5-small

UPLOAD_DIR=storage/uploads
PROCESSED_DIR=storage/processed
```

## Docker Setup

The project currently uses Docker Compose for PostgreSQL and Qdrant.

Example `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16
    container_name: hirth_knowledge_postgres
    environment:
      POSTGRES_DB: hirth_knowledge_db
      POSTGRES_USER: hirth_user
      POSTGRES_PASSWORD: hirth_password
    ports:
      - "5439:5432"
    volumes:
      - hirth_postgres_data:/var/lib/postgresql/data

  qdrant:
    image: qdrant/qdrant:latest
    container_name: hirth_knowledge_qdrant
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - hirth_qdrant_data:/qdrant/storage

volumes:
  hirth_postgres_data:
  hirth_qdrant_data:
```

Start services:

```bash
docker compose up -d
```

Stop services:

```bash
docker compose down
```

Reset local database volume:

```bash
docker compose down -v
docker compose up -d
```

## Database

PostgreSQL is used for storing document metadata.

Current table:

### `documents`

Stores uploaded document information.

Fields include:

* `id`
* `original_filename`
* `stored_filename`
* `file_path`
* `file_type`
* `file_size`
* `status`
* `error_message`
* `created_at`
* `updated_at`

Current document statuses:

```text
uploaded
processing
processed
failed
```

## Running the Backend Locally

### 1. Go to backend folder

```bash
cd D:\hackxplore\backend
```

### 2. Create virtual environment

```bash
python -m venv venv
```

### 3. Activate virtual environment

Windows PowerShell:

```powershell
.\venv\Scripts\Activate.ps1
```

Linux/macOS:

```bash
source venv/bin/activate
```

### 4. Install dependencies

```bash
pip install -r requirements.txt
```

### 5. Start Docker services

```bash
docker compose up -d
```

### 6. Run FastAPI server

```bash
python -m uvicorn app.main:app --reload
```

### 7. Open API docs

```text
http://127.0.0.1:8000/docs
```

## Testing Database Connection

Check running containers:

```bash
docker ps
```

Expected containers:

```text
hirth_knowledge_postgres
hirth_knowledge_qdrant
```

Connect to PostgreSQL:

```bash
docker exec -it hirth_knowledge_postgres psql -U hirth_user -d hirth_knowledge_db
```

Show tables:

```sql
\dt
```

Exit PostgreSQL:

```sql
\q
```

Test backend database settings:

```bash
python -c "from app.core.config import get_settings; s=get_settings(); print(s.postgres_host, s.postgres_port, s.postgres_db, s.postgres_user, s.postgres_password)"
```

Expected output:

```text
localhost 5439 hirth_knowledge_db hirth_user hirth_password
```

## Common Errors and Fixes

### Error: `No module named 'app'`

Cause: Uvicorn was started from the wrong directory.

Fix:

```bash
cd D:\hackxplore\backend
python -m uvicorn app.main:app --reload
```


## Why Qdrant?

Qdrant is used as the vector database because the product needs more than basic text search.

It supports:

* Semantic vector search
* Metadata filtering
* Payload storage
* Hybrid search support
* Docker-based deployment
* Clean FastAPI integration

In this system:

```text
PostgreSQL = system of record
Qdrant = semantic retrieval engine
```

PostgreSQL stores document metadata and application data.
Qdrant stores chunk embeddings and retrieves relevant knowledge for RAG.

## Next Development Milestone

The next milestone is:

```text
Document extraction + chunk generation
```

Next files to implement:

```text
app/services/extraction_service.py
app/services/chunking_service.py
app/providers/document_parser/base.py
app/providers/document_parser/docling_parser.py
app/providers/document_parser/table_parser.py
```

Expected next flow:

```text
Upload document
        ↓
Save metadata
        ↓
Extract text using Docling or Pandas
        ↓
Generate chunks
        ↓
Save chunks
        ↓
Prepare chunks for embedding
```

## Product Vision

The final product should not be just a PDF chatbot.

The goal is to build a production-ready technical knowledge platform that converts fragmented two-stroke engine documents into structured, searchable, source-grounded knowledge.

Final product capabilities should include:

* Document upload
* Automatic extraction
* Intelligent chunking
* Semantic search
* Metadata filtering
* Source-grounded answers
* Diagram and table awareness
* Expert feedback loop
* Knowledge graph support in future
