import os
import sys
from pathlib import Path

# Set VERCEL environment flag to ensure tempfile directory paths
os.environ["VERCEL"] = "1"

ROOT_DIR = Path(__file__).resolve().parent.parent
SERVER_DIR = ROOT_DIR / "server"

# Add SERVER_DIR and ROOT_DIR to sys.path so server.py and extractor.py can import seamlessly
for p in (SERVER_DIR, ROOT_DIR):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

try:
    import server
    app = getattr(server, "app")
except AttributeError:
    from server.server import app

# Vercel Serverless automatically exposes ASGI 'app'
