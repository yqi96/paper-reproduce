---
name: reproduce-paper-workflow
description: Universal workflow for reproducing any scientific paper. Requires OMC and browser-pilot.
argument-hint: "<doi> --dir=<path>"
user-invocable: true
allowed-tools: Bash Read Write AskUserQuestion
---
$ARGUMENTS

# Reproduce Paper Workflow Skill

Universal 7-step pipeline for scientific paper reproduction. Covers all paper types (computational, experimental/wet lab, theoretical, qualitative/survey) through adaptive process extraction and human-delegated steps.

## Definition of Reproduction

**Reproduction = executing every process step the authors performed, one step at a time, with the same data.**

- Zero approximations allowed. If real data is unavailable, the script exits — it does not substitute proxy data.
- Any deviation from the original paper must be resolved or explicitly reported as FAIL.
- The original paper (Methods, captions, supplementary) is the only authority.
- Standard domain knowledge (textbook formulas cited but not derived in the paper) may be used but must be documented as "assumed standard, not paper-verified" in the QA report.
- Process correctness is a prerequisite for meaningful result comparison. Results are compared in Step 4 after all process steps pass.

## When to Activate

- User says "reproduce paper", "复现论文", "paper reproduction", "论文复现"
- Any request to reproduce figures, results, or findings from a scientific paper

## Arguments

```
/reproduce-paper-workflow <doi> --dir=<path>
```

- `doi` — e.g. `10.1038/s41586-021-03819-2`
- `--dir` — working directory where all artifacts are saved (required)

---

## Prerequisites

This workflow requires two external dependencies. Run `npm run setup` or install manually:

### OMC (oh-my-claudecode)

Required for `/ralph` execution in Step 3.

- **Check**: `omc --version`
- **Install**: `npm i -g oh-my-claude-sisyphus@latest`

### browser-pilot

Required for `/web-scout` browser-based information retrieval in Step 1.

- **Check**: Look for `mcpServers.browser` in `~/.claude.json`
- **Install**: `npx --package=@yqi96/browser-pilot@latest browser-pilot-install`

---

## Workflow

### Step 0 — Paper Access

Use the fetch-paper skill to download the PDF:

```bash
/fetch-paper <doi> --dir=<path>
```

fetch-paper uses a three-stage fallback chain: Sci-Hub mirrors → web-scout open access search → AskUserQuestion (user provides PDF). All stages are tried in order; if all fail, the workflow cannot proceed.

Then write `<path>/paper_access_log.md` **before doing anything else**:

```markdown
# Paper Access Log

## Bibliographic Info
- **DOI**: {doi}
- **Title**: {full title}
- **Authors**: {author list}
- **Journal**: {journal name, year, volume, pages}
- **Fetched at**: {ISO timestamp}

## Access Status
- **Status**: FULL_TEXT | NO_ACCESS
- **Source**: sci_hub ({mirror}) | open_access ({url}) | user_provided | none
- **PDF path**: {absolute path or "N/A"}

## Abstract
{paste abstract}

## Paper Type (inferred)
{computational | experimental | theoretical | qualitative | mixed — inferred from paper, not user-provided}

## Key Results to Reproduce
- Result {N}: {description} — type: figure | table | quantitative conclusion | qualitative conclusion
```

**Gate**: `paper_access_log.md` must exist before proceeding to Step 1.

---

### Step 1 — Process Extraction

Read the **full paper** — Methods, supplementary materials, appendices, figure captions — and extract every process step the authors performed.

Produce `<path>/process_checklist.md` with one entry per step:

```markdown
# Process Checklist

## S01 — {Step Name}
- **executor**: agent | human
- **description**: {What is done. What the expected output artifact is.}
- **paper_source**: {Section/paragraph reference, e.g. "Methods §2.3, p.5"}
- **dependencies**: [S00] | []
- **type**: process | result
- **tool**: {for agent executor: python | r | sympy | lean | browser | general} (omit for human executor)
- **artifact_path**: artifacts/S01/{filename} (filled during execution)
- **status**: pending

---

## S02 — {Step Name}
...
```

**Field definitions:**
- `executor`: `agent` for anything the agent can execute (code, browser, file operations, symbolic computation); `human` for wet lab work, physical experiments, surveys, procurement, field work
- `type`: `process` for intermediate steps; `result` for steps that directly produce a paper-reported figure, table, or conclusion
- `tool`: for agent-executor steps, specifies the primary tool: `python` (uv), `r`, `sympy` (symbolic math), `lean` (formal proof), `browser` (web tasks), `general`
- `artifact_path`: the designated save path — filled in during execution, not left blank after
- `status`: `pending` → `complete` | `fail` | `blocked`

**What counts as a process step:**
- Data collection, download, preprocessing
- Statistical analysis, modeling, simulation
- Running experiments (computational or physical)
- Mathematical derivations and proof verification (theoretical papers)
- Surveys, interviews, literature searches
- Any intermediate computation that feeds into a result

**Sub-tools available:**
- `/web-scout <doi> --dir=<path>` — for finding and verifying data sources; results become a process step artifact

**Gate**: `process_checklist.md` must be complete before Step 2.

---

### Step 2 — Human Confirms Checklist

Present `process_checklist.md` to the human via `AskUserQuestion` and ask them to confirm:

1. No process steps are missing
2. `executor` assignments are correct (agent vs human)
3. `type` classifications are correct (process vs result)
4. `tool` assignments are correct for agent-executor steps
5. Step order and dependencies make sense

The human may edit the checklist directly. After any edits, confirm the updated checklist is saved.

**Gate**: Human must explicitly confirm the checklist before Step 3 begins.

---

### Step 3 — Ralph Execution (requires OMC — see Prerequisites)

Run `/ralph --dir=<path>`. Ralph reads `process_checklist.md` and generates PRD stories internally — no pre-generated `prd.json` file required.

**PRD generation is idempotent**: if a step already has `status: complete` in the checklist, ralph skips that story. This provides automatic recovery — if the workflow is interrupted, re-run `/reproduce-paper-workflow <doi> --dir=<path>` and ralph resumes from the first non-complete step.

For each story:

#### Agent-Executor Stories
- Execute automatically using the tool specified in the `tool` field:
  - `python`/`r`: write and run code with `uv`
  - `sympy`: run symbolic computations to verify formulas
  - `lean`: write formal proofs for theorem verification
  - `browser`/`general`: use available agent tools
- Save all artifacts to `artifacts/<step_id>/` — **never delete intermediate artifacts**
- Update `process_checklist.md` status to `complete` after each story passes
- Each story verified by `paper-alignment-verifier` before marked complete

#### Human-Executor Stories
Use `AskUserQuestion` to delegate to the human. The agent must:

1. **Generate a novice-level operation guide** — treat the human as someone with no domain background. Include:
   - Numbered steps (no assumed knowledge)
   - Exact equipment, reagents, or tools needed (with quantities and specifications)
   - Where to save the output and in what format
   - What to do if something goes wrong

2. **Present the guide** via `AskUserQuestion` with a clear question: "Please follow the guide above and confirm when complete, including the path where you saved the output."

3. **Receive the human's response** and record the artifact path in `process_checklist.md`.

4. **Record sub_status** in `process_checklist.md` for the human step — track: `guide_sent` → `awaiting_response` → `artifact_received` → `complete`. This enables artifact-driven resume: if interrupted, check `artifacts/<step_id>/` for existing artifacts before re-prompting.

**Human response handling:**
- **If guidance is insufficient** (human cannot follow the steps): refine the guide with more detail and retry
- **If human is uncooperative or refuses**: mark story FAIL with reason "human non-cooperative — [details]"; document in `process_checklist.md`
- **If human provides partial feedback**: handle case-by-case; document the decision and justification

**Artifact tracing rule**: Every story — agent or human — must save artifacts to `artifacts/<step_id>/` and update the checklist status. This is non-negotiable.

---

### Step 4 — Result Comparison

After all PRD stories complete, invoke the result comparison skill:

```
/paper-result-comparison --dir=<path>
```

This skill covers all result-type items identified in Step 1:
- **Figures** — internal figure extraction (pymupdf, 3× zoom) + structured visual diff
- **Tables** — numeric value comparison
- **Quantitative conclusions** — verify computed statistics match paper-stated values
- **Qualitative conclusions** — verify consistency of reproduced conclusions with paper
- **Other result types** — agent judgment

Output: `<path>/result_comparison_report.md` with per-item verdicts (PASS | ACCEPTED DEVIATION | FAIL) and an overall text assessment.

**Fix loop** (same as before):
1. QA identifies discrepancy
2. Investigate root cause — re-read paper, check data, check code
3. Fix and re-run
4. Repeat until resolved or all reasonable options exhausted
5. If unresolvable: ACCEPTED DEVIATION (with justification) or FAIL

---

### Step 5 — Document README

Write or update `<path>/README.md`:

```markdown
# Paper: {Title}

**DOI**: {doi}
**Authors**: {authors}
**Journal**: {journal, year}
**Paper type**: {computational | experimental | theoretical | qualitative | mixed}

## Overview
{1-2 sentence summary}

## Process Checklist Summary
| Step | Executor | Tool | Status |
|------|----------|------|--------|
| S01 — {name} | agent/human | python/sympy/lean/— | complete/fail |

## Data Sources
| Dataset | Repository | URL | Format |
|---------|-----------|-----|--------|

## Reproduction Steps
{How to run — commands for computational steps, references to human steps}

## Run Statistics
- **Runtime**: {N} seconds (computational steps)
- **Human steps**: {count} ({list step IDs})
- **Figures generated**: {list}

## Result Comparison Summary
| Result | Type | Match | Notes |
|--------|------|-------|-------|
| Fig {N} | figure | PASS/ACCEPTED DEVIATION/FAIL | |
| Table {N} | table | PASS/ACCEPTED DEVIATION/FAIL | |

## Assumptions
{Standard formulas/methods used that the paper did not explicitly derive}

## Known Differences / FAIL Items
{Deviations that could not be resolved, with scientific impact assessment}
```

---

## Paper-Alignment Criteria for PRD Stories (Per-Story Process Level)

When using `/ralph` to drive this workflow, **every PRD story MUST include `paper-alignment-verifier` process criteria** covering method implementation, data sources, sample construction, and experimental steps. Output appearance is never a per-story acceptance criterion.

> **Output matching is forbidden as per-story evidence.** The process must be correct regardless of whether the output happens to look similar. Visual or numerical output matching belongs exclusively to Step 4 (result comparison).

**Core process categories (per-story use):**

| Category | What it verifies |
|----------|-----------------|
| `METHOD` | Formula / algorithm / protocol in code or guide matches Methods section verbatim |
| `DATA` | Data file is the one the paper used (same dataset, version, columns) — no fallback approximations |
| `SAMPLE` | Sample size N, filtering, and merge key match the paper exactly |
| `STEPS` | Preprocessing and computation order matches the paper's Methods |

**Scope categories (per-story use — checks completeness, not result quality):**

| Category | What it verifies |
|----------|-----------------|
| `FIGURES` | Script generates every figure the paper contains (correct count, panel structure, axis labels from captions) |
| `TABLES` | Script generates every table / summary statistic the paper reports |
| `CONCLUSIONS` | Script produces the data needed to compute the paper's quantitative claims (computability check, not value match) |

> `FIGURES`, `TABLES`, `CONCLUSIONS` are **scope and completeness** checks — they verify the script produces all required outputs with the right structure. They do NOT compare output values against the paper. Value comparison happens at Step 4.

**Criterion format:**
```
paper-alignment-verifier <CATEGORY> PASS: <specific process claim traced to paper section>
```

**What is NOT a valid per-story acceptance criterion:**
- ~~"Fig 4a looks like the paper figure"~~ — result matching belongs to Step 4
- ~~"The CDF curves appear correct"~~ — visual similarity is not process evidence
- ~~"Results are approximately right"~~ — approximation is fabrication
- ~~"Output matches paper"~~ — forbidden at the per-story level

**How it works:** When ralph encounters a `paper-alignment-verifier <CATEGORY> PASS:` criterion, it delegates to the `paper-alignment-verifier` custom agent as a subagent. The agent reads the paper's Methods section and the relevant artifacts, returns a structured process verdict. If any criterion is not PASS, the story is not marked complete.

---

## Two-Level Verification Model

| Level | When | What is checked | Tool |
|-------|------|----------------|------|
| **Per-story (process)** | During each ralph story (Step 3) | Was the process done correctly? (methods, data, steps match paper) | `paper-alignment-verifier` |
| **Final (result)** | After all stories complete (Step 4) | Does the output match the paper? (figures, tables, conclusions) | `paper-result-comparison` |

---

## ANTI-FABRICATION RULES

> **NEVER write code before all required data is downloaded and verified**
>
> **NEVER write fallback approximations — missing data = sys.exit(), not a proxy**
>
> **NEVER hardcode fake data or invent dataset values**
>
> **NEVER skip Result Comparison — always compare against paper at Step 4**
>
> **ALWAYS use browser to verify data URLs before downloading** (via web-scout)
>
> **ALWAYS save artifacts to artifacts/<step_id>/ — never delete intermediate artifacts**
>
> **ALWAYS inner-merge derived data to the canonical sample list — never use a superset**
>
> **ALWAYS document standard formulas used (Assumptions table) even if not fabrication**
>
> **ALWAYS treat human as a novice — provide step-by-step guides with no assumed knowledge**

---

## Gate Summary

| Gate | Artifact | When |
|------|----------|------|
| Gate 0 | `paper_access_log.md` | Before Step 1 |
| Gate 1 | `process_checklist.md` complete | Before Step 2 |
| Gate 2 | Human confirms checklist | Before Step 3 (ralph) |
| Gate 3 | All PRD stories pass (ralph complete) | Before Step 4 |
| Gate 4 | `result_comparison_report.md` complete | Before Step 5 |

---

## Notes

- **Script location**: `reproduce.py` in the paper directory (for computational papers — artifact of the relevant process step)
- **Output**: all figures go to `artifacts/<step_id>/`
- **Data caching**: scripts should be idempotent — skip download if file exists
- **Zip exploration**: always `zf.namelist()[:30]` before writing any filter
- **Sub-tools**: `web-scout` for data source verification; `paper-result-comparison` handles all figure extraction and comparison internally
- **Data acquisition**: no longer a fixed standalone step — becomes a PRD story when the paper's process requires external data
- **Recovery**: re-run `/reproduce-paper-workflow <doi> --dir=<path>` after interruption — ralph resumes from first non-complete step
