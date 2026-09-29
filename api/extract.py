import os
import sys
import tempfile
import uuid
from pathlib import Path
from typing import Optional

os.environ["VERCEL"] = "1"
os.environ["PYDANTIC_DISABLE_PLUGINS"] = "1"

ROOT_DIR = Path(__file__).resolve().parent.parent
SERVER_DIR = ROOT_DIR / "server"

for p in (SERVER_DIR, ROOT_DIR):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

try:
    from server import extractor
except ImportError:
    import extractor  # type: ignore

DATA_DIR = Path(tempfile.gettempdir()) / "polarpdf"
UPLOADS_DIR = DATA_DIR / "uploads"
IMAGES_DIR = DATA_DIR / "images"
EXPORTS_DIR = DATA_DIR / "exports"

for d in (DATA_DIR, UPLOADS_DIR, IMAGES_DIR, EXPORTS_DIR):
    try:
        d.mkdir(parents=True, exist_ok=True)
    except OSError:
        pass

app = FastAPI(title="polarpdf Extract API", redirect_slashes=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Vercel serverless functions enforce a 4.5MB edge limit; local/custom environments capped at 25MB
MAX_FILE_BYTES = 25 * 1024 * 1024


@app.api_route("/", methods=["GET", "POST", "OPTIONS"])
@app.api_route("/extract", methods=["GET", "POST", "OPTIONS"])
@app.api_route("/api/extract", methods=["GET", "POST", "OPTIONS"])
async def extract_handler(
    request: Request,
    file: Optional[UploadFile] = File(None),
    pdf: Optional[UploadFile] = File(None),
):
    """Handle GET (info check), OPTIONS (CORS), and POST (PDF processing)."""
    if request.method == "OPTIONS":
        return JSONResponse({"status": "ok"})

    if request.method == "GET":
        return JSONResponse({
            "status": "ready",
            "endpoint": "/api/extract",
            "method": "POST",
            "content_type": "multipart/form-data",
        })

    # Guard 1: Inspect Content-Length header before reading full body
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_FILE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Uploaded file exceeds payload limit of {MAX_FILE_BYTES // (1024 * 1024)}MB.",
        )

    upload_file = file or pdf
    if not upload_file:
        raise HTTPException(status_code=400, detail="No file provided. Please upload a PDF file.")
    if not (upload_file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    raw_filename = upload_file.filename or "upload.pdf"
    unique_prefix = uuid.uuid4().hex[:8]
    saved_filepath = UPLOADS_DIR / f"{unique_prefix}_{raw_filename}"
    try:
        content = await upload_file.read()
        if len(content) > MAX_FILE_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"Uploaded file exceeds payload limit of {MAX_FILE_BYTES // (1024 * 1024)}MB.",
            )

        with open(saved_filepath, "wb") as f:
            f.write(content)

        parsed_data = extractor.parse_pdf_question_bank(
            str(saved_filepath),
            extract_images=True,
            output_dir=str(DATA_DIR),
        )

        extractor.export_all(parsed_data, output_dir=str(EXPORTS_DIR))
        return JSONResponse(content=parsed_data)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if saved_filepath.exists():
            try:
                saved_filepath.unlink()
            except OSError:
                pass
