---
name: web-scout
description: Reliable deep information retrieval via real browser. Starts from an anchor (PDF, URL, or query), opens a browser, navigates to real content, probes structure, and outputs a verified intelligence map before any downstream use.
argument-hint: "<anchor> <what_to_find> [output_path]"
user-invocable: true
context: fork
agent: general-purpose
allowed-tools: Bash Read Write mcp__browser__browser_open mcp__browser__browser_close mcp__browser__navigate_page mcp__browser__take_snapshot mcp__browser__take_screenshot mcp__browser__click mcp__browser__fill mcp__browser__wait_for mcp__browser__list_pages mcp__browser__new_page mcp__browser__close_page
aliases:
  - deep-fetch
  - info-scout
---
$ARGUMENTS

# Web Scout

**Why browser, not fetch:** Programmatic fetch returns what the server renders — often incomplete HTML, gated content, or JavaScript-heavy pages that don't load without a real browser. Browser opens a real Chrome session, clicks through, sees exactly what a human would see.

Web Scout depth levels:

| Approach | What you get | Problem |
|----------|-------------|---------|
| Programmatic fetch | Raw HTML, often incomplete | JS-rendered content missing, headers may block |
| **Browser (this skill)** | Full rendered page, interactive navigation | **What you actually need** |

---

## Prerequisites

Invoke the `/browser` skill first to ensure Chrome is open and ready:
```
/browser
```

---

## When to Use

Use Web Scout when you need information that will be **acted on** (code written, decisions made, claims published):

- Finding a dataset and its exact field names before writing a parser
- Locating API documentation and confirming endpoint URLs are real
- Tracking down the authoritative source for a fact (not the first Google result)
- Finding the correct version/file/checksum before downloading
- Any time a previous fetch attempt returned wrong data, 404, or a login wall

**Do NOT use for:** casual reading, quick one-off lookups, conversational context.

---

## Arguments

```
/web-scout <anchor> <what_to_find> [output_path]
```

- `anchor` — where to start. One of:
  - A local file path (PDF, HTML, markdown): `papers/65_reimer_2020/paper.pdf`
  - A URL: `https://example.org/dataset`
  - A natural language description: `"attention mechanism survey paper by Vaswani et al. 2017"`
- `what_to_find` — brief description of the target intelligence
- `output_path` — where to write the intelligence map (defaults to `./scout_map.md`)

---

## Core Principle

**NEVER use the first thing you find. Always verify in the browser.**

The most common failures:
- URL looks right but returns 404 or wrong data
- Field name looks obvious but means something different (`t` = ring offset, not age)
- Encoding assumed to be UTF-8, actually `latin-1`
- Landing page says "available" but actual download requires login
- JS-rendered content invisible to programmatic fetch

---

## Workflow

### Step 0 — Open browser

```
/browser
```

Then open a new tab:
```
mcp__browser__new_page(url="about:blank")
```

---

### Step 1 — Establish anchor and extract leads

**If anchor is a local file (PDF, doc):**
```
Read(file_path="<anchor>")
```
Focus on:
- Data Availability / Source Code / Methods sections
- Figure captions (often cite exact source)
- Acknowledgements (data providers)
- Supplementary material references
- Any explicit URLs, DOIs, accession numbers, repository names

Then open each URL found directly in browser.

**If anchor is a URL:**
```
mcp__browser__navigate_page(url="<anchor>")
mcp__browser__take_snapshot()
```

**If anchor is a natural language description:**
```
mcp__browser__navigate_page(url="https://www.google.com/search?q=<what_to_find>+data+source")
mcp__browser__take_snapshot()
```
Click through to the 2–3 most promising results. Do not stop at the search results page.

**Record every lead found.** Do not filter yet.

---

### Step 2 — Navigate to actual content (not landing pages)

For each lead URL:
```
mcp__browser__navigate_page(url="<lead_url>")
mcp__browser__take_snapshot()
```

**Click through to the actual file/data/endpoint** — do not stop at the landing page:
```
mcp__browser__click(uid="<download_or_files_button_uid>")
mcp__browser__take_snapshot()
```

Common patterns:
- **Zenodo**: landing page → click "Files" tab → get direct download URL
- **GitHub**: repo page → navigate to file → click "Raw" button → copy raw URL
- **Figshare**: landing page → click individual file → get download link
- **API docs**: overview page → find endpoint reference → locate example request with real URL
- **Institutional sites**: often directory listings — browse to the actual file

Record the **exact direct URL** of the real content, not the wrapper page.

---

### Step 3 — Probe content structure

**Do not assume format. Inspect before parsing.**

Navigate to the direct file URL in browser to preview content:
```
mcp__browser__navigate_page(url="<direct_file_url>")
mcp__browser__take_snapshot()
```

For binary or large files, download a sample via curl and inspect locally:
```bash
# Plain download
curl -sL "<url>" -o sample_probe && head -50 sample_probe

# If 403 (common for scientific/institutional sites):
curl -sL "<url>" \
  -H "User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:120.0)" \
  -o sample_probe && head -50 sample_probe

# Detect encoding (critical — latin-1 vs UTF-8 silently corrupts data)
python3 -c "
with open('sample_probe', 'rb') as f:
    raw = f.read(500)
    print(repr(raw))
"
```

Record:
- Exact delimiter (comma / tab / space / pipe)
- Comment/header lines (starts with `#`, `%`, `!`, or plain text)
- Encoding (`latin-1`, `utf-8`, `utf-16`)
- First 3 data rows

---

### Step 4 — Map field names and semantics

```python
import pandas as pd

try:
    df = pd.read_csv('sample_probe', comment='#', sep='\t')
except UnicodeDecodeError:
    df = pd.read_csv('sample_probe', comment='#', sep='\t', encoding='latin-1')

print(df.columns.tolist())   # exact column names
print(df.dtypes)
print(df.head(3))
```

**Cross-reference column names against the source document.** Common traps:
- `t` / `year` / `age` / `calage` — which timescale? (BP, CE, BCE, offset from present)
- `error` / `sigma` / `1sigma` / `uncertainty` — different conventions
- `value` / `measurement` / `r_date` / `d14c` — check units and sign convention
- Flag columns (often undocumented — check the README or paper)

---

### Step 5 — Map authentication and rate limits

For any access-controlled resource, check robots.txt in browser:
```
mcp__browser__navigate_page(url="<base_url>/robots.txt")
mcp__browser__take_snapshot()
```

Check the browser network tab for auth headers on real requests:
```
mcp__browser__list_network_requests()
```

Then probe via curl:
```bash
# Check HTTP status and response headers
curl -sI "<api_endpoint>" | grep -i "rate\|limit\|auth\|key\|www-authenticate"
```

If 401/403: navigate in browser to find the credentials/signup page:
```
mcp__browser__navigate_page(url="<base_url>/api" or "<base_url>/docs")
mcp__browser__take_snapshot()
```

---

### Step 6 — Cross-verify (for high-stakes information)

If the information will be used in code, papers, or decisions:
1. Navigate to a second independent source in browser
2. Compare field names / values / structure between sources
3. Note any discrepancies

```
mcp__browser__new_page(url="<second_source_url>")
mcp__browser__take_snapshot()
```

---

## Output: Intelligence Map

Write `{output_path}` with this structure:

```markdown
# Intelligence Map — {what_to_find}

## Scout Session
- **Anchor**: {anchor}
- **Target**: {what_to_find}
- **Scouted at**: {ISO timestamp}

## Sources Found

### Source 1: {Name}
- **URL (landing)**: {landing page}
- **URL (direct)**: {actual file/endpoint URL}
- **Type**: File download / REST API / GraphQL / Other
- **Auth required**: No / Yes ({how to get credentials})
- **User-Agent required**: No / Yes
- **Rate limit**: None known / {N} req/sec

## Content Structure

### {filename or endpoint}
- **Format**: CSV / JSON / NetCDF / HDF5 / Other
- **Encoding**: utf-8 / latin-1 / other
- **Delimiter**: comma / tab / space / other
- **Comment char**: `#` / `%` / none
- **Header rows**: {N}

| Field Name (exact) | Meaning | Units | Notes |
|--------------------|---------|-------|-------|
| {col} | {description} | {units} | {gotcha if any} |

## Verified Gotchas
- [ ] Encoding: {confirmed value}
- [ ] User-Agent: required / not required
- [ ] Auth: required / not required
- [ ] Field trap: {e.g. "`t` is ring offset, NOT calendar age"}
- [ ] Rate limit: {value or "not observed"}

## Sample Access Code

```python
import requests, pandas as pd
from io import StringIO

URL = "{direct_url}"
HEADERS = {"User-Agent": "Mozilla/5.0"}  # remove if not needed

resp = requests.get(URL, headers=HEADERS)
resp.encoding = "{encoding}"
df = pd.read_csv(
    StringIO(resp.text),
    comment="{comment_char}",
    sep="{delimiter}",
    skiprows={N},
)
print(df.columns.tolist())
print(df.head(3))
```

## Verification Status
- [ ] Direct URL confirmed accessible (seen in browser)
- [ ] Field names cross-referenced with source document
- [ ] Encoding confirmed
- [ ] Sample downloaded and parsed
- [ ] Auth/rate-limit status known
- [ ] Ready for downstream use
```

---

## Domain Examples

### Scientific datasets
- Anchor: paper PDF → find "Data Availability" → open Zenodo/Figshare in browser → click Files → get direct URL → probe CSV
- Watch for: `latin-1` encoding, `User-Agent` blocks, ambiguous field names

### REST APIs
- Anchor: API docs URL → open in browser → find endpoint reference → use network tab to capture real requests → check auth headers
- Watch for: versioned endpoints (`/v1/` vs `/v2/`), required `Accept` headers, pagination

### GitHub repositories
- Anchor: repo URL in browser → navigate to file → click Raw → copy raw URL
- Watch for: `main` vs `master`, LFS-stored files (need separate download), generated vs source files

### Academic facts / statistics
- Anchor: search in browser → click through to primary source (not news article citing a study)
- Watch for: misquoted statistics, outdated numbers, paywalled originals

---

## Key Lessons

1. **Open a real browser** — JS-rendered pages, session cookies, redirects: only a real browser handles all of these correctly.

2. **Click through, don't stop at landing pages** — Zenodo, Figshare, Dryad all have landing pages. The actual file URL is one more click away. Always get the direct URL.

3. **Field names are not obvious** — `t` / `year` / `age` / `calage` / `index` can mean different things depending on context. Column 't' in some datasets is an offset or index, not the measurement itself — always verify field semantics from the paper's data dictionary.

4. **`latin-1` is everywhere in science** — old geological/climate datasets predate UTF-8 standardization. Probe with `open(f,'rb').read(200)` before parsing.

5. **User-Agent blocks are silent** — a 403 with no message often means you need a browser-like User-Agent. The browser network tab shows you the real headers being sent.

6. **Download one sample first** — 3–5 rows before writing any loop. This catches delimiter, encoding, and header issues immediately.

7. **Second source = sanity check** — if the field value looks off, open a second source in a new browser tab to confirm before writing the parser.

8. **Read the README** — most data repos include one. Navigate to it in browser, read it before touching the data.
