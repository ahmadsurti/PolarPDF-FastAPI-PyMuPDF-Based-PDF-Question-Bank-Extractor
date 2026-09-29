import os
import sys
from pathlib import Path

os.environ["VERCEL"] = "1"

ROOT_DIR = Path(__file__).resolve().parent.parent
SERVER_DIR = ROOT_DIR / "server"

for p in (SERVER_DIR, ROOT_DIR):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

try:
    import server
    app = getattr(server, "app")
except AttributeError:
    from server.server import app
