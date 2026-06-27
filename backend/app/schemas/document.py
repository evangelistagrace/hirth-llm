from datetime import datetime

from pydantic import BaseModel


class DocumentResponse(BaseModel):
    id: int
    original_filename: str
    stored_filename: str
    file_path: str
    file_type: str
    file_size: int
    status: str
    error_message: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }