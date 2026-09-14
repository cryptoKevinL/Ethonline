#!/usr/bin/env python3
"""Simple file browser: lists all files under a root directory and serves
a browsable HTTP index for them.

Usage:
    python3 file_server.py [root_dir] [port]
"""
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import quote

ROOT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else ".")
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8000
BIND = "127.0.0.1"

EXCLUDE_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv"}


def list_files(root):
    files = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        for name in filenames:
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, root)
            files.append(rel)
    return sorted(files)


class BrowseHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        if self.path == "/":
            self.send_index()
        else:
            super().do_GET()

    def send_index(self):
        files = list_files(ROOT)
        rows = "\n".join(
            f'<li><a href="/{quote(f)}">{f}</a></li>' for f in files
        )
        html = f"""<!DOCTYPE html>
<html>
<head><title>File Browser</title></head>
<body>
<h1>Files in {ROOT}</h1>
<p>{len(files)} files</p>
<ul>
{rows}
</ul>
</body>
</html>"""
        encoded = html.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)


def main():
    files = list_files(ROOT)
    print(f"Found {len(files)} files under {ROOT}:")
    for f in files:
        print(f"  {f}")

    server = HTTPServer((BIND, PORT), BrowseHandler)
    print(f"\nServing on http://{BIND}:{PORT}  (Ctrl+C to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.shutdown()


if __name__ == "__main__":
    main()
