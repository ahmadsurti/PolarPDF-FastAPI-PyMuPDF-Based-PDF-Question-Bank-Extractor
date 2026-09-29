"""
polarpdf — Universal Offline Question Bank & Python PDF Extractor Bridge
Serves the PWA dashboard and provides /api/extract for processing institutional PDFs.
Usage:
  Local: python server/server.py
  Render/Production: uvicorn server.server:app --host 0.0.0.0 --port $PORT
"""

import os
import sys
import json
import warnings
from pathlib import Path
from typing import Dict, Any

import uuid
import tempfile

# Disable unneeded Pydantic third-party plugins (e.g. broken logfire environment plugins)
os.environ["PYDANTIC_DISABLE_PLUGINS"] = "1"
warnings.filterwarnings("ignore", message=r".*logfire-plugin.*")

from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

# 50 MB maximum payload limit for standalone/local instances
MAX_LOCAL_UPLOAD_BYTES = 50 * 1024 * 1024

# Ensure server directory is on sys.path for extractor import
SERVER_DIR = Path(__file__).resolve().parent
REPO_ROOT = SERVER_DIR.parent
DIST_DIR = REPO_ROOT / "dist"

# Detect read-only serverless environments (Vercel, AWS Lambda)
IS_SERVERLESS = os.environ.get("VERCEL") == "1" or os.environ.get("AWS_LAMBDA_FUNCTION_NAME") is not None

if IS_SERVERLESS:
    DATA_DIR = Path(tempfile.gettempdir()) / "polarpdf"
else:
    DATA_DIR = SERVER_DIR / "data"

UPLOADS_DIR = DATA_DIR / "uploads"
IMAGES_DIR = DATA_DIR / "images"
EXPORTS_DIR = DATA_DIR / "exports"

for d in (DATA_DIR, UPLOADS_DIR, IMAGES_DIR, EXPORTS_DIR):
    try:
        d.mkdir(parents=True, exist_ok=True)
    except OSError:
        pass

if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))

try:
    from . import extractor
except ImportError:
    import extractor  # noqa: E402

app = FastAPI(
    title="polarpdf API",
    description="Deterministic Offline Question Bank & Diagram Extractor",
    version="1.0.0",
    redirect_slashes=False,
)

# CORS: Allow frontend in development (port 5173) and production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
@app.get("/health")
@app.get("/api")
@app.get("/")
async def health_check():
    """Health check endpoint for Render / Vercel / monitoring."""
    return {
        "status": "ok",
        "app": "polarpdf",
        "serverless": IS_SERVERLESS,
        "production_ready": DIST_DIR.exists(),
    }


@app.get("/api/extract")
@app.get("/extract")
async def extract_info():
    """Information endpoint for PDF extraction."""
    return {
        "status": "ready",
        "method": "POST",
        "content_type": "multipart/form-data",
        "param": "file",
    }


@app.post("/api/extract")
@app.post("/extract")
async def extract_pdf(
    request: Request,
    file: UploadFile = File(None),
    pdf: UploadFile = File(None),
):
    """Upload institutional PDF, extract questions, options, answers, and diagrams."""
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_LOCAL_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds maximum allowed size ({MAX_LOCAL_UPLOAD_BYTES // (1024 * 1024)}MB).",
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
        if len(content) > MAX_LOCAL_UPLOAD_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File exceeds maximum allowed size ({MAX_LOCAL_UPLOAD_BYTES // (1024 * 1024)}MB).",
            )

        with open(saved_filepath, "wb") as f:
            f.write(content)

        print(f"[*] Extracting PDF: {raw_filename} ({len(content)} bytes)...")
        parsed_data = extractor.parse_pdf_question_bank(
            str(saved_filepath),
            extract_images=True,
            output_dir=str(DATA_DIR),
        )

        # Synchronize exports (JSON, flat, markdown, csv)
        extractor.export_all(parsed_data, output_dir=str(EXPORTS_DIR))

        total = parsed_data.get("metadata", {}).get("total_questions", 0)
        print(f"[SUCCESS] Extracted {total} questions from {raw_filename}")
        return JSONResponse(content=parsed_data)

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Extraction failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if saved_filepath.exists():
            try:
                saved_filepath.unlink()
            except OSError:
                pass


@app.post("/api/save")
@app.post("/save")
async def save_project(payload: Dict[str, Any]):
    """Save and re-export question bank data."""
    try:
        source_name = payload.get("metadata", {}).get("source_file", "questions")
        base_slug = Path(source_name).stem
        target_json = EXPORTS_DIR / f"{base_slug}_structured.json"

        with open(target_json, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)

        extractor.export_all(payload, output_dir=str(EXPORTS_DIR))
        return {"status": "ok", "message": f"Saved and synchronized {base_slug}"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Mount Extracted Images ──────────────────────────────────────────
# Images saved by extractor to data/images/{slug} are accessible at /images/{slug}/{filename}
app.mount("/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")


# ── Production Static Frontend Mount (Render / Standalone / Local Only) ──
# On Vercel, static frontend files are served directly by the Vercel edge CDN.
if not IS_SERVERLESS:
    if (DIST_DIR / "index.html").exists():
        if (DIST_DIR / "assets").exists():
            app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")

        @app.get("/{full_path:path}")
        async def serve_spa(full_path: str):
            target = DIST_DIR / full_path
            if full_path and target.is_file():
                return FileResponse(target)
            return FileResponse(DIST_DIR / "index.html")
    else:
        @app.get("/")
        async def dev_root():
            return {
                "message": "polarpdf API server is running.",
                "mode": "development",
                "frontend": "Run 'npm run dev' to access the Vite React dashboard at http://localhost:5173",
                "health": "/api/health",
            }


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print("================================================================")
    print("  polarpdf — Unified Question Bank Full-Stack Server")
    print(f"  Listening on: http://0.0.0.0:{port}")
    if (DIST_DIR / "index.html").exists():
        print(f"  Mode: PRODUCTION (serving frontend from {DIST_DIR})")
    else:
        print("  Mode: DEVELOPMENT (run 'npm run dev' for hot-reloading Vite frontend)")
    print("================================================================")
    uvicorn.run(app, host="0.0.0.0", port=port)
