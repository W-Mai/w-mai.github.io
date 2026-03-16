#!/usr/bin/env python3
"""List all SiYuan documents with size info for blog import evaluation."""
import json, urllib.request

API = "http://127.0.0.1:6808"

def post(path, data=None):
    req = urllib.request.Request(
        f"{API}{path}",
        data=json.dumps(data or {}).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())["data"]

def list_docs(notebook, path="/", depth=0):
    files = post("/api/filetree/listDocsByPath", {"notebook": notebook, "path": path, "maxListCount": 100})["files"]
    for f in files:
        name = f["name"].replace(".sy", "")
        size = f["hSize"]
        mtime = f["hMtime"]
        sub = f["subFileCount"]
        prefix = "  " * depth
        marker = "📁" if sub > 0 else "📄"
        print(f"{prefix}{marker} {name}  ({size}, {mtime})")
        if sub > 0:
            list_docs(notebook, f["path"], depth + 1)

notebooks = post("/api/notebook/lsNotebooks")["notebooks"]
for nb in notebooks:
    print(f"\n{'='*60}")
    print(f"📓 {nb['name']}  (id: {nb['id']})")
    print(f"{'='*60}")
    list_docs(nb["id"])
