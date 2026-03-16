#!/usr/bin/env python3
"""Import a SiYuan document as a blog post (MDX with co-located images)."""
import json, os, re, sys, urllib.request, urllib.error

API = "http://127.0.0.1:6808"
POSTS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "posts")


def post(path, data=None):
    req = urllib.request.Request(
        f"{API}{path}",
        data=json.dumps(data or {}).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())["data"]


def fetch_image(notebook_id, asset_path):
    """Download an image asset from SiYuan."""
    url = f"{API}/{asset_path}"
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req) as r:
            return r.read()
    except urllib.error.HTTPError:
        return None


def clean_kramdown(raw: str) -> str:
    """Strip SiYuan kramdown block attributes and convert to clean markdown."""
    lines = raw.split("\n")
    cleaned = []
    for line in lines:
        # Remove block-level IAL like {: id="..." updated="..."}
        line = re.sub(r'\{:\s+id="[^"]*"[^}]*\}', "", line)
        # Remove inline IAL like {: style="width: 657px;"}
        line = re.sub(r'\{:\s+style="[^"]*"\}', "", line)
        # Remove other remaining IAL
        line = re.sub(r'\{:\s+[^}]*\}', "", line)
        # Remove zero-width spaces (U+200B) often left by SiYuan inline code
        line = line.replace("\u200b", "")
        cleaned.append(line.rstrip())

    # Collapse 3+ consecutive blank lines into 2
    result = []
    blank_count = 0
    for line in cleaned:
        if line == "":
            blank_count += 1
            if blank_count <= 2:
                result.append(line)
        else:
            blank_count = 0
            result.append(line)

    # Remove blank lines right after code fence opening
    final = []
    for i, line in enumerate(result):
        if i > 0 and line == "" and result[i - 1].startswith("```"):
            continue
        final.append(line)

    # Strip trailing blanks
    while final and final[-1] == "":
        final.pop()

    return "\n".join(final)


def extract_images(content: str) -> list[str]:
    """Extract all image asset paths from markdown content."""
    return re.findall(r"!\[.*?\]\((assets/[^)]+)\)", content)


def rewrite_image_paths(content: str, image_map: dict[str, str]) -> str:
    """Rewrite image paths from assets/... to ./<local_name>."""
    for old_path, new_name in image_map.items():
        content = content.replace(f"({old_path})", f"(./{new_name})")
    return content


def build_frontmatter(title: str, pub_date: str, category: str = "", tags: list[str] = None) -> str:
    """Build YAML frontmatter block."""
    fm = f"""---
title: '{title}'
description: ''
pubDate: '{pub_date}'
tags: {json.dumps(tags or [], ensure_ascii=False)}
category: "{category}"
---"""
    return fm


def main():
    if len(sys.argv) < 2:
        print("Usage: python siyuan-import.py <document_id> [--slug <slug>] [--category <cat>] [--tags tag1,tag2]")
        sys.exit(1)

    doc_id = sys.argv[1]
    slug = None
    category = "代码"
    tags = []

    # Parse optional args
    i = 2
    while i < len(sys.argv):
        if sys.argv[i] == "--slug" and i + 1 < len(sys.argv):
            slug = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == "--category" and i + 1 < len(sys.argv):
            category = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == "--tags" and i + 1 < len(sys.argv):
            tags = [t.strip() for t in sys.argv[i + 1].split(",") if t.strip()]
            i += 2
        else:
            i += 1

    # Fetch document
    print(f"Fetching document {doc_id}...")
    result = post("/api/block/getBlockKramdown", {"id": doc_id})
    raw = result.get("kramdown", "")
    if not raw:
        print("Error: empty document")
        sys.exit(1)

    # Extract title from last line IAL or first heading
    title_match = re.search(r'title="([^"]+)"', raw)
    title = title_match.group(1) if title_match else "Untitled"

    # Extract date from doc ID (format: 20241017023153)
    date_match = re.match(r"(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})", doc_id)
    if date_match:
        y, mo, d, h, mi, s = date_match.groups()
        pub_date = f"{y}-{mo}-{d}T{h}:{mi}+08:00"
    else:
        pub_date = "2024-01-01T00:00+08:00"

    # Generate slug from doc_id if not provided
    if not slug:
        # Convert title to slug-friendly format
        slug = title.lower().replace(" ", "-")
        slug = re.sub(r"[^a-z0-9\u4e00-\u9fff-]", "", slug)
        if not slug:
            slug = f"post-{doc_id[:8]}"

    # Clean content
    content = clean_kramdown(raw)

    # Remove the document-level IAL at the end (title/type/updated)
    content = re.sub(r'\n*\{[^}]*title="[^"]*"[^}]*\}\s*$', "", content)

    # Extract and download images
    image_paths = extract_images(content)
    image_map = {}
    post_dir = os.path.join(POSTS_DIR, slug)
    os.makedirs(post_dir, exist_ok=True)

    # Get notebook ID for image fetching
    block_info = post("/api/block/getBlockInfo", {"id": doc_id})
    notebook_id = block_info.get("box", "")

    for asset_path in image_paths:
        filename = os.path.basename(asset_path)
        print(f"  Downloading {filename}...")
        img_data = fetch_image(notebook_id, asset_path)
        if img_data:
            local_path = os.path.join(post_dir, filename)
            with open(local_path, "wb") as f:
                f.write(img_data)
            image_map[asset_path] = filename
            print(f"    -> saved ({len(img_data)} bytes)")
        else:
            print(f"    -> FAILED to download")

    # Rewrite image paths
    content = rewrite_image_paths(content, image_map)

    # Build final MDX
    frontmatter = build_frontmatter(title, pub_date, category, tags)
    mdx = f"{frontmatter}\n\n{content}\n"

    # Write file
    out_path = os.path.join(post_dir, "index.mdx")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(mdx)

    print(f"\nDone! Created {out_path}")
    print(f"  Title: {title}")
    print(f"  Slug: {slug}")
    print(f"  Images: {len(image_map)}/{len(image_paths)}")


if __name__ == "__main__":
    main()
