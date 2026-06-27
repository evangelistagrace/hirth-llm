from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.repositories.document_repository import DocumentRepository
from app.schemas.document import DocumentResponse
from app.utils.file_utils import save_upload_file, validate_file_extension

router = APIRouter(prefix="/ingestion", tags=["Ingestion"])

settings = get_settings()


@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    try:
        if not file.filename:
            raise ValueError("Uploaded file has no filename")

        file_type = validate_file_extension(file.filename)

        stored_filename, file_path, file_size = await save_upload_file(
            upload_file=file,
            upload_dir=settings.upload_dir,
        )

        document_repository = DocumentRepository(db)

        document = document_repository.create_document(
            original_filename=file.filename,
            stored_filename=stored_filename,
            file_path=file_path,
            file_type=file_type,
            file_size=file_size,
        )

        return document

    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload document: {str(error)}",
        )