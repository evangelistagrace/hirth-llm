from sqlalchemy.orm import Session

from app.models.document import Document, DocumentStatus


class DocumentRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_document(
        self,
        original_filename: str,
        stored_filename: str,
        file_path: str,
        file_type: str,
        file_size: int,
    ) -> Document:
        document = Document(
            original_filename=original_filename,
            stored_filename=stored_filename,
            file_path=file_path,
            file_type=file_type,
            file_size=file_size,
            status=DocumentStatus.UPLOADED,
        )

        self.db.add(document)
        self.db.commit()
        self.db.refresh(document)

        return document

    def get_document_by_id(self, document_id: int) -> Document | None:
        return (
            self.db.query(Document)
            .filter(Document.id == document_id)
            .first()
        )

    def list_documents(self) -> list[Document]:
        return (
            self.db.query(Document)
            .order_by(Document.created_at.desc())
            .all()
        )