---
name: fetch-paper
description: Fetch a paper PDF given a DOI. Primary: Sci-Hub mirrors. Fallback 1: browser searche. Fallback 2: AskUserQuestion asks user to provide PDF. Produces paper_access_log.md recording the source.
argument-hint: "<doi> <path>"
user-invocable: true
context: fork
agent: general-purpose
allowed-tools: Bash Read Write AskUserQuestion
---
$ARGUMENTS

# Fetch Paper Skill

Download a paper PDF given a DOI. Uses a three-stage fallback chain:
1. **Sci-Hub** mirrors (primary)
2. **web-scout** — searches google, publisher and institutional repositories for open-access versions
3. **AskUserQuestion** — asks the user to provide the PDF directly

## Workflow

### Stage 1 — Sci-Hub

Run the installed script to attempt download from Sci-Hub mirrors:

```bash
uv run ~/.paper-reproduce/scripts/fetch_paper.py "$0" "$1"
```

**Do NOT download papers rapidly.** Sci-Hub will ban your IP if you send too many
requests in a short time. Rules:
- Wait **≥6 seconds** between individual downloads
- If downloading multiple papers, add manual pauses between invocations

**If Stage 1 succeeds**: record `source: sci_hub` in `paper_access_log.md`, skip to Write Log.

**If Stage 1 fails**: proceed to Stage 2.

### Stage 2 — browser (open access search)

Invoke `/browser` to search for an open-access version of the paper:

```
/browser "Find DOI: $0 open access PDF"
```

If an open-access PDF URL is found:
1. Download it using `Bash` (curl, wget or requests)
2. Validate the downloaded file starts with `%PDF`
3. Save to `$1` as `$0.pdf`
4. Record `source: open_access` and the URL in `paper_access_log.md`

**If Stage 2 succeeds**: record `source: open_access`, skip to Write Log.

**If Stage 2 fails**: proceed to Stage 3.

### Stage 3 — User provides PDF

Use `AskUserQuestion` to ask the user:

> "Could not find an open-access version of **$0** via Sci-Hub or public repositories.
>
> Please provide the PDF:
> - Download manually and provide the local file path, OR
> - Provide a direct download URL

Options: [I have a local file path] [I have a download URL] [Cannot obtain — abort]

If user provides a path: copy or symlink to `$1/$0.pdf`, validate `%PDF` header.
If user provides a URL: download it, validate, save.
If user obtains the paper successfully: record `source: user_provided` in `paper_access_log.md`.
If user cannot obtain: write `paper_access_log.md` with `Status: NO_ACCESS`.

Record `source: user_provided` in `paper_access_log.md`.

### Write `paper_access_log.md`

After any successful stage or failure, write `{output_dir}/paper_access_log.md`:

```markdown
# Paper Access Log

## Bibliographic Info
- **DOI**: {doi}
- **Fetched at**: {ISO timestamp}

## Access Status
- **Status**: FULL_TEXT | NO_ACCESS
- **Source**: sci_hub ({mirror}) | open_access ({url}) | user_provided | none
- **PDF path**: {absolute path or "N/A"}

## Notes
{which stages were attempted, any errors encountered}
```

### Report

On success:
```
✓ Paper fetched: {doi}
  PDF: {path}
  Source: {sci_hub|open_access|user_provided}
  Log: {output_dir}/paper_access_log.md
```

On failure:
```
✗ Fetch failed: {doi}
  Tried: Sci-Hub (3 mirrors), web-scout open access search, user prompt
  Reason: {error or "user could not provide PDF"}
```

## Notes

- **Script**: `~/.paper-reproduce/scripts/fetch_paper.py` — installed external script
- **SSL**: always `verify=False` — Sci-Hub mirrors use self-signed certs
- **Fallback order**: Sci-Hub → /browser → user — each stage only attempted if the previous fails
