---
name: reproduce-paper-workflow
description: Universal workflow for reproducing any scientific paper. Requires OMC and browser-pilot.
argument-hint: "<doi> <path>"
user-invocable: true
allowed-tools: Bash Read Write AskUserQuestion
---
$ARGUMENTS

# Reproduce Paper Workflow Skill

Universal 7-step pipeline for scientific paper reproduction. Covers all paper types (computational, experimental/wet lab, theoretical, qualitative/survey) through adaptive process extraction and human-delegated steps.

## Definition of Reproduction

**Reproduction = executing every process step the authors performed**

- Zero approximations allowed. If real data is unavailable, the reproduction exits — it does not substitute proxy data.
- Any deviation from the original paper must be resolved or explicitly reported as FAIL.
- The original paper (Methods, captions, supplementary) is the only authority.
- Standard domain knowledge (textbook formulas cited but not derived in the paper) may be used but must be documented as "assumed standard, not paper-verified" in the final report.
- Process correctness is a prerequisite for meaningful result comparison. Results are compared in Step 4 after all process steps pass.

## When to Activate

- User says "reproduce paper", "复现论文", "paper reproduction", "论文复现"
- Any request to reproduce figures, results, or findings from a scientific paper

## Arguments

```
/reproduce-paper-workflow <doi> <path>
```

- `doi` — e.g. `10.1038/s41586-021-03819-2`
- `path` — working directory where all artifacts are saved (required)

## Workflow

### Step 0 — Paper Access

Invoke the fetch-paper skill to download the PDF:

```
/fetch-paper $0 $1
```

fetch-paper skill will write `$1/paper_access_log.md`.

**Gate**: `paper_access_log.md` must exist before proceeding to Step 1.

---

### Step 1 — Process Extraction

Read the **full paper** — Methods, supplementary materials, appendices, figure captions — and extract every process step the authors performed.

Produce `$1/process_checklist.md` with one entry per step, using the template below:

```markdown
# Process Checklist

> **Global rule**: Before marking any story complete, write
> `artifacts/<step_id>/execution_log.md` and invoke `paper-alignment-verifier`
> with the execution log path, artifact paths, and paper PDF path.
> A story may only be marked complete when the verifier returns PASS or ACCEPTED DEVIATION.

## S01 — {Step Name}
- **executor**: agent | human
- **description**: {What is done. What the expected output artifact is.}
- **paper_source**: {Section/paragraph reference, e.g. "Methods §2.3, p.5"}
- **dependencies**: [S00] | []
- **type**: process | result
- **artifact_path**: artifacts/S01/{filename} (filled during execution)

---

## S02 — {Step Name}
...
```

**What counts as a process step:**
- Data collection, download, preprocessing
- Statistical analysis, modeling, simulation
- Running experiments (computational or physical)
- Mathematical derivations and proof verification (theoretical papers)
- Surveys, interviews, literature searches
- Any intermediate computation that feeds into a result

**Gate**: `process_checklist.md` must be complete before Step 2.

---

### Step 2 — Human Confirms Checklist

Present `process_checklist.md` to the human via `AskUserQuestion` and ask them to confirm:

1. No process steps are missing
2. `executor` assignments are correct (agent vs human)
3. `type` classifications are correct (process vs result)
4. Step order and dependencies make sense

The human may edit the checklist directly. After any edits, confirm the updated checklist is saved.

**Gate**: Human must explicitly confirm the checklist before Step 3 begins.

---

### Step 3 — Ralph Execution

Invoke ralph: `/ralph @$1/process_checklist.md`. 
Ralph will execute each story in order, respecting dependencies. Stories with `executor: agent` are executed automatically; stories with `executor: human` are delegated to the human by ralph via `AskUserQuestion`.

#### Agent-Executor Stories
- Execute automatically
- Save all artifacts to `$1/artifacts/<step_id>/` — **never delete intermediate artifacts**
- After completing any story work:
  1. Write `$1/artifacts/<step_id>/execution_log.md` — record all tools used, key decisions, and artifacts produced
  2. Invoke `paper-alignment-verifier` as a subagent, providing: execution log path, artifact paths, and paper PDF path
- If verifier returns PASS or ACCEPTED DEVIATION: update `process_checklist.md` status to `complete`
- If verifier returns FAIL: do NOT mark complete — fix the issue and re-invoke the verifier before proceeding; if unresolvable, mark story FAIL with reason and abort

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
/paper-result-comparison <path>
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


## ANTI-FABRICATION RULES

> **NEVER write code before all required data is downloaded and verified**
>
> **NEVER write fallback approximations — missing data = sys.exit(), not a proxy**
>
> **NEVER hardcode fake data or invent dataset values**
>
> **NEVER skip Result Comparison — always compare against paper at Step 4**
>
> **ALWAYS use browser to verify data URLs before downloading**
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

- **Script location**: artifact of the relevant process step
- **Output**: all outputs go to `artifacts/<step_id>/`
- **Recovery**: re-run `/reproduce-paper-workflow <doi> <path>` after interruption — ralph resumes from first non-complete step
