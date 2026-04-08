---
name: fetch-paper
description: Fetch a paper PDF via Sci-Hub given a DOI. Uses a fixed script (no code regeneration). Produces paper_access_log.md. Rate-limited to avoid IP ban.
argument-hint: "<doi> [output_dir]"
user-invocable: true
context: fork
agent: general-purpose
allowed-tools: Bash Read Write
---
$ARGUMENTS

# Fetch Paper Skill

Download a paper PDF from Sci-Hub given a DOI using the inline script below.

## ⚠️ Rate Limit Warning

**Do NOT download papers rapidly.** Sci-Hub will ban your IP if you send too many
requests in a short time. Rules:
- Wait **≥6 seconds** between individual downloads
- For batches, the script enforces a 3s delay between mirror attempts
- If downloading multiple papers, add manual pauses between invocations

## When to Activate

- User says "fetch paper", "download paper", "get PDF", "paper_access_log"
- Step 0 of the reproduction pipeline (paper access gate before writing any code)

## Arguments

```
/fetch-paper <doi> [output_dir]
```

- `doi` — e.g. `10.1038/s41586-021-03819-2`
- `output_dir` — where to save the PDF and `paper_access_log.md` (defaults to `.`)

## Workflow

### Step 1 — Run the inline script

```bash
uv run --with requests --with beautifulsoup4 --with urllib3 - "<doi>" "<output_dir>" << 'PYEOF'
import re, sys, time
from pathlib import Path
import requests, urllib3
from bs4 import BeautifulSoup

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

MIRRORS = ["https://sci-hub.ru", "https://sci-hub.st", "https://sci-hub.se"]
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"}

def sanitize(s): return re.sub(r"[^\w\-.]", "_", s)[:80]

def clean_url(url, mirror):
    url = url.strip().replace("\\", "")
    if url.startswith("//"): return "https:" + url
    if url.startswith("/"): return mirror.rstrip("/") + url
    if not url.startswith("http"): return mirror.rstrip("/") + "/" + url
    return url

def make_session():
    s = requests.Session()
    s.headers.update(HEADERS)
    return s

def fetch_pdf_url(doi, mirror, session):
    try:
        resp = session.get(f"{mirror.rstrip('/')}/{doi}", timeout=20, verify=False)
        soup = BeautifulSoup(resp.text, "html.parser")
        meta = soup.find("meta", {"name": "citation_pdf_url"})
        if meta and meta.get("content"): return clean_url(meta["content"], mirror)
        obj = soup.find("object", {"type": "application/pdf"})
        if obj and obj.get("data"): return clean_url(obj["data"], mirror)
        div = soup.find("div", class_="download")
        if div and div.find("a"): return clean_url(div.find("a")["href"], mirror)
        m = re.search(r'data\s*=\s*["\']([^"\']+\.pdf[^"\']*)["\']', resp.text)
        if m: return clean_url(m.group(1), mirror)
    except Exception as e:
        print(f"  [ERROR] {mirror}: {e}")
    return None

doi = sys.argv[1]
output_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(".")
output_dir.mkdir(parents=True, exist_ok=True)
out_path = output_dir / (sanitize(doi.replace("/", "_")) + ".pdf")

print(f"\n[fetch_paper] DOI: {doi}")
print(f"[fetch_paper] Output: {output_dir}")
print("[fetch_paper] ⚠️  Rate limit: wait ≥6s between papers to avoid IP ban\n")

if out_path.exists():
    print(f"✓ SKIP (already exists): {out_path}")
    sys.exit(0)

session = make_session()

pdf_url = used_mirror = None
for mirror in MIRRORS:
    print(f"  Trying {mirror}...")
    pdf_url = fetch_pdf_url(doi, mirror, session)
    if pdf_url:
        used_mirror = mirror
        print(f"  [INFO] PDF URL: {pdf_url}")
        break
    time.sleep(3)

if not pdf_url:
    print("\n✗ FAIL: PDF URL not found on any mirror")
    sys.exit(1)

r = session.get(pdf_url, timeout=60, stream=True, verify=False, headers={"Referer": used_mirror})
if r.status_code != 200:
    print(f"\n✗ FAIL: HTTP {r.status_code}")
    sys.exit(1)

content = b"".join(r.iter_content(8192))
if content[:4] != b"%PDF":
    print(f"\n✗ FAIL: Not a valid PDF (got: {content[:20]!r})")
    sys.exit(1)

out_path.write_bytes(content)
print(f"\n✓ OK: {out_path}")
PYEOF
```

The script:
1. Tries `sci-hub.ru` → `sci-hub.st` → `sci-hub.se` in order
2. Uses 4 HTML strategies to find the PDF URL (meta tag, object tag, download div, regex)
3. Downloads with `Referer` header set to the mirror
4. Validates the file starts with `%PDF` (rejects HTML error pages)
5. Saves as `{sanitized_doi}.pdf` in `output_dir`

### Step 2 — Write `paper_access_log.md`

After the script exits, write `{output_dir}/paper_access_log.md`:

```markdown
# Paper Access Log

## Bibliographic Info
- **DOI**: {doi}
- **Fetched at**: {ISO timestamp}

## Access Status
- **Status**: FULL_TEXT | NO_ACCESS
- **Source**: sci_hub ({mirror}) | none
- **PDF path**: {absolute path or "N/A"}

## Notes
{which mirrors were tried, any errors}
```

### Step 3 — Report

On success:
```
✓ Paper fetched: {doi}
  PDF: {path}
  Log: {output_dir}/paper_access_log.md
```

On failure:
```
✗ Fetch failed: {doi}
  Tried: sci-hub.ru, sci-hub.st, sci-hub.se
  Reason: {error}
```

## Examples

```bash
uv run --with requests --with beautifulsoup4 --with urllib3 - \
  10.1038/s41586-021-03819-2 papers/jumper_2021_alphafold << 'PYEOF'
[inline script body]
PYEOF
```

## Notes

- **Script**: inlined via heredoc — no external files required
- **SSL**: always `verify=False` — Sci-Hub mirrors use self-signed certs
- **Mirror order**: `sci-hub.ru` first (most reliable), then `.st`, `.se`
- **Do NOT use** Semantic Scholar or Unpaywall as primary — unreliable for paywalled papers
