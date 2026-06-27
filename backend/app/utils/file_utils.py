from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

SUPPORTED_EXTENSIONS = {
    ".pdf",
    ".docx",
    ".pptx",
    ".txt",
    ".csv",
    ".xlsx",
}


def validate_file_extension(filename: str) -> str:
    extension = Path(filename).suffix.lower()

    if extension not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"Unsupported file type: {extension}")

    return extension


async def save_upload_file(
    upload_file: UploadFile,
    upload_dir: str,
) -> tuple[str, str, int]:
    original_filename = upload_file.filename

    if not original_filename:
        raise ValueError("Uploaded file has no filename")

    extension = validate_file_extension(original_filename)

    Path(upload_dir).mkdir(parents=True, exist_ok=True)

    stored_filename = f"{uuid4().hex}{extension}"
    file_path = Path(upload_dir) / stored_filename

    content = await upload_file.read()

    with open(file_path, "wb") as file:
        file.write(content)

    file_size = len(content)

    return stored_filename, str(file_path), file_size