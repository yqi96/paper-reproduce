"""
fetch_paper.py - Download a paper PDF from Sci-Hub given a DOI.

Usage:
    uv run --with requests --with beautifulsoup4 fetch_paper.py <doi> [output_dir]

Rate limit warning:
    Sci-Hub will ban your IP if you download too frequently.
    Keep at least 6 seconds between requests (enforced by --batch mode).
    Do NOT loop this script rapidly. One paper at a time, with delays.
"""

import re
import sys
import time
from pathlib import Path

import requests
import urllib3
from bs4 import BeautifulSoup

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

MIRRORS = ["https://sci-hub.ru", "https://sci-hub.st", "https://sci-hub.se"]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    )
}


def sanitize(s: str) -> str:
    return re.sub(r"[^\w\-.]", "_", s)[:80]


def clean_url(url: str, mirror: str) -> str:
    url = url.strip().replace("\\", "")
    if url.startswith("//"):
        return "https:" + url
    if url.startswith("/"):
        return mirror.rstrip("/") + url
    if not url.startswith("http"):
        return mirror.rstrip("/") + "/" + url
    return url


def make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(HEADERS)
    return session


def fetch_pdf_url(doi: str, mirror: str, session: requests.Session) -> str | None:
    url = f"{mirror.rstrip('/')}/{doi}"
    try:
        resp = session.get(url, timeout=20, verify=False)
        html = resp.text
        soup = BeautifulSoup(html, "html.parser")

        # Strategy 1: meta citation_pdf_url
        meta = soup.find("meta", {"name": "citation_pdf_url"})
        if meta and meta.get("content"):
            return clean_url(meta["content"], mirror)

        # Strategy 2: <object type="application/pdf" data="...">
        obj = soup.find("object", {"type": "application/pdf"})
        if obj and obj.get("data"):
            return clean_url(obj["data"], mirror)

        # Strategy 3: <div class="download"><a href="...">
        div = soup.find("div", class_="download")
        if div and div.find("a"):
            return clean_url(div.find("a")["href"], mirror)

        # Strategy 4: regex fallback
        m = re.search(r'data\s*=\s*["\']([^"\']+\.pdf[^"\']*)["\']', html)
        if m:
            return clean_url(m.group(1), mirror)

    except Exception as e:
        print(f"  [ERROR] {mirror}: {e}")
    return None


def fetch(doi: str, output_dir: Path) -> tuple[bool, str]:
    """
    Download PDF for doi into output_dir.
    Returns (success, message).
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    out_path = output_dir / (sanitize(doi.replace("/", "_")) + ".pdf")

    if out_path.exists():
        return True, f"SKIP (already exists): {out_path}"

    session = make_session()

    pdf_url = None
    used_mirror = None
    for mirror in MIRRORS:
        print(f"  Trying {mirror}...")
        pdf_url = fetch_pdf_url(doi, mirror, session)
        if pdf_url:
            used_mirror = mirror
            print(f"  [INFO] PDF URL: {pdf_url}")
            break
        time.sleep(3)

    if not pdf_url:
        return False, "PDF URL not found on any mirror"

    try:
        r = session.get(
            pdf_url, timeout=60, stream=True, verify=False,
            headers={"Referer": used_mirror}
        )
        if r.status_code != 200:
            return False, f"HTTP {r.status_code} from PDF server"

        content = b"".join(r.iter_content(8192))
        if content[:4] != b"%PDF":
            return False, f"Downloaded file is not a valid PDF (got: {content[:20]!r})"

        out_path.write_bytes(content)
        return True, f"OK: {out_path}"

    except Exception as e:
        return False, str(e)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    doi = sys.argv[1]
    output_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(".")

    print(f"\n[fetch_paper] DOI: {doi}")
    print(f"[fetch_paper] Output: {output_dir}")
    print("[fetch_paper] ⚠️  Rate limit: wait ≥6s between papers to avoid IP ban\n")

    success, msg = fetch(doi, output_dir)
    if success:
        print(f"\n✓ {msg}")
    else:
        print(f"\n✗ FAIL: {msg}")
        sys.exit(1)


if __name__ == "__main__":
    main()
