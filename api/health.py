import os
import sys
from pathlib import Path

os.environ["VERCEL"] = "1"
os.environ["PYDANTIC_DISABLE_PLUGINS"] = "1"

ROOT_DIR = Path(__file__).resolve().parent.parent
SERVER_DIR = ROOT_DIR / "server"

for p in (SERVER_DIR, ROOT_DIR):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

app = FastAPI(title="polarpdf Health API", redirect_slashes=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.api_route("/", methods=["GET", "HEAD", "OPTIONS"])
@app.api_route("/health", methods=["GET", "HEAD", "OPTIONS"])
@app.api_route("/api/health", methods=["GET", "HEAD", "OPTIONS"])
async def health_handler():
    return JSONResponse({"status": "ok", "app": "polarpdf", "serverless": True})
