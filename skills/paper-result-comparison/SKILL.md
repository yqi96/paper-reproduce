---
name: paper-result-comparison
description: Structured comparison of all reproduced results against the original paper. Called after ralph execution completes (Step 5 of reproduce-paper-workflow). Covers figures, tables, quantitative conclusions, and qualitative conclusions. Never fabricates values — missing artifacts = BLOCKED, not assumed.
argument-hint: "<paper_number>"
user-invocable: true
context: fork
agent: general-purpose
allowed-tools: Bash Read Write
---
$ARGUMENTS

# Paper Result Comparison Skill

Structured post-execution result comparison for scientific paper reproduction. Called after all ralph PRD stories pass (Step 5 of `reproduce-paper-workflow`). Compares every result-type item identified in `process_checklist.md` against the paper.

## When to Activate

- Step 5 of `reproduce-paper-workflow` (automatic)
- User says "compare results", "result QA", "结果对比", after completing ralph execution

## Arguments

```
/paper-result-comparison <paper_number>
```

- `paper_number` — e.g. `65` (used to locate paper directory and artifacts)

---

## Prerequisites

Before running this skill, confirm:
- All ralph PRD stories have `passes: true`
- `process_checklist.md` exists and all `result`-type steps have `status: complete` and a populated `artifact_path`
- Original paper PDF is accessible at the path recorded in `paper_access_log.md`

If any result-type step has `status: fail` or `status: blocked` or an empty `artifact_path`, mark that result item as **BLOCKED** in the report — do not attempt to compare a missing artifact.

---

## Sub-Tools

| Sub-tool | Used for |
|----------|----------|
| `/scientific-figure-qa <paper_number>` | Figure-to-figure visual comparison |
| Direct agent reading | Tables, quantitative conclusions, qualitative conclusions |

---

## Procedure

### 1. Read the result inventory

Read `process_checklist.md` and collect all steps with `type: result`. These are the items to compare. Group by result type:
- **figure** — produces a plot/chart/image
- **table** — produces a numeric table
- **quantitative conclusion** — produces a specific stated statistic (R²=0.82, n=671, p<0.05)
- **qualitative conclusion** — produces a theme, narrative finding, or conceptual claim
- **other** — any result type not covered above

### 2. Extract originals from paper

For each result item, read the corresponding section of the paper PDF and extract:
- Figures: the original figure image (via `/paper-figure-extractor <paper_number>` if available)
- Tables: the exact numeric values as stated in the paper
- Quantitative conclusions: the exact statistic as stated in the paper text
- Qualitative conclusions: the exact claim or theme as stated in the paper text

### 3. Compare each item

For each result item, apply the appropriate comparison method (see sections below).

### 4. Write report

Write `result_comparison_report.md` with all comparison results (see output format below).

---

## Comparison Methods

### Figures

Delegate to `scientific-figure-qa`:

```
/scientific-figure-qa <paper_number>
```

For each figure, the sub-tool returns a per-figure verdict. Record it in the report.

If `scientific-figure-qa` is unavailable, compare visually by reading the reproduced figure and original figure side-by-side, noting:
- Axis ranges, labels, units
- Data distribution and trends
- Color coding, legend, panel structure
- Any panels missing or added

### Tables

For each table:
1. Read the paper's table values exactly
2. Read the reproduced table artifact (CSV, printed output, or generated table file)
3. Compare value by value for every numeric cell

**Tolerance**: exact match unless the paper's Methods imply rounding. Document any rounding assumption.

For each value record:
- Paper value: {exact value from paper}
- Reproduced value: {exact value from artifact}
- Match: PASS | ACCEPTED DEVIATION (with tolerance justification) | FAIL

### Quantitative Conclusions

For each quantitative claim stated in the paper text (e.g., "R²=0.82", "n=671", "p<0.001"):
1. Read the exact claim from the paper
2. Compute or read the corresponding value from the reproduced artifacts
3. Compare

**Tolerance**: exact match for counts and sample sizes; statistical results may differ by floating-point precision — document the difference.

### Qualitative Conclusions

For each qualitative conclusion or theme stated in the paper:
1. Read the paper's stated conclusion
2. Read the reproduced analysis output or field notes (for human-delegated steps)
3. Assess whether the reproduced data/analysis supports the same conclusion

**Verdict criteria:**
- PASS — reproduced finding is consistent with paper's conclusion
- ACCEPTED DEVIATION — finding is partially consistent; note what differs and why it does not invalidate the conclusion
- FAIL — reproduced finding contradicts or cannot support the paper's conclusion

### Other Result Types

Apply agent judgment. Document the comparison method used in the report.

---

## Verdict Definitions

| Verdict | Meaning |
|---------|---------|
| **PASS** | Reproduced result matches paper exactly (or within documented floating-point precision) |
| **ACCEPTED DEVIATION** | Reproduced result differs but the deviation is scientifically non-significant; justification required |
| **FAIL** | Reproduced result differs and the deviation affects the scientific conclusion, or the deviation cannot be justified |
| **BLOCKED** | Artifact is missing (step failed, human did not complete, or file not found) — cannot compare |

**ACCEPTED DEVIATION requires a full justification block:**
```
- Cause: {why this deviation is unavoidable — library version, OS rounding, platform difference}
- Impact: {does it affect the scientific conclusion? yes/no — explain}
- Substitutability: {is the reproduced version scientifically equivalent?}
```

---

## Output Format

Write `result_comparison_report.md` in the paper directory:

```markdown
# Result Comparison Report
**Paper**: {title}
**DOI**: {doi}
**Comparison date**: {ISO timestamp}
**Prerequisites**: All ralph stories passed | {N} result-type steps in checklist

---

## Figures

| Figure | Artifact | Paper match | Verdict | Notes |
|--------|----------|-------------|---------|-------|
| Fig 1 | artifacts/S04/fig1.png | Fig 1 (paper p.5) | PASS | |
| Fig 2a | artifacts/S07/fig2a.png | Fig 2a (paper p.7) | ACCEPTED DEVIATION | Color differs (see below) |
| Fig 3 | — | Fig 3 (paper p.9) | BLOCKED | S06 status: fail |

{For each ACCEPTED DEVIATION, add justification block:}
### Fig 2a — Accepted Deviation Justification
- Cause: matplotlib 3.9 default colormap differs from paper's custom palette (not specified in Methods)
- Impact: No — color is decorative; data distribution identical
- Substitutability: Yes — scientific content equivalent

---

## Tables

| Table | Metric | Paper value | Reproduced value | Verdict |
|-------|--------|-------------|-----------------|---------|
| Table 2 | Top-1 Accuracy | 76.1% | 75.8% | ACCEPTED DEVIATION |
| Table 2 | Top-5 Accuracy | 92.9% | 92.7% | ACCEPTED DEVIATION |
| Table 3 | FLOPs | 4.1G | 4.1G | PASS |

{For each ACCEPTED DEVIATION or FAIL, add explanation:}
### Table 2 Top-1 Accuracy — Accepted Deviation Justification
- Cause: floating-point rounding and minor stochastic variation in training; within reported variance
- Impact: No — difference is 0.3%, below any scientific threshold
- Substitutability: Yes

### Table 2 Top-5 Accuracy — Accepted Deviation Justification
- Cause: same stochastic training variation as Top-1; within reported variance
- Impact: No — difference is 0.2%, below any scientific threshold
- Substitutability: Yes

---

## Quantitative Conclusions

| Claim | Paper states | Reproduced | Verdict |
|-------|-------------|------------|---------|
| Q1 | "Model achieves 76.1% top-1 accuracy" | 75.8% reproduced | ACCEPTED DEVIATION |
| Q2 | "Training converges in 90 epochs" | Loss curve confirms convergence at epoch 88 | PASS |

{Justification blocks for ACCEPTED DEVIATION / FAIL as above}

---

## Qualitative Conclusions

| Conclusion ID | Paper states | Reproduced finding | Verdict |
|--------------|-------------|-------------------|---------|
| L1 | "Residual connections enable training of very deep networks" | Training loss decreases smoothly with skip connections; diverges without | PASS |
| L2 | "Batch normalization is critical for convergence" | Ablation shows 12% accuracy drop without BN | PASS |

{Justification blocks as above}

---

## Other Results

{Any result types not covered above — document comparison method and verdict}

---

## Paper-Level Assessment

**Summary**: {N_pass} PASS, {N_dev} ACCEPTED DEVIATION, {N_fail} FAIL, {N_blocked} BLOCKED

**Overall assessment**:
{Narrative paragraph: evaluate reproduction fidelity, scientific significance of any deviations,
whether the paper's main claims are supported by the reproduction, and the overall reproducibility
verdict. Note any systematic issues (e.g., all failures stem from one unresolved data ambiguity).
Do not give a single binary grade — explain the nuance.}
```

---

## ANTI-FABRICATION RULES

> **NEVER invent or estimate a reproduced value** — if the artifact does not exist, the verdict is BLOCKED, not an estimated match
>
> **NEVER mark PASS without reading both the paper value and the artifact value**
>
> **NEVER skip result items** — every result-type step in `process_checklist.md` must appear in the report
>
> **ALWAYS read the paper text directly** — do not rely on memory for paper-stated values
>
> **ALWAYS document the artifact path read** — traceability is required
>
> **ALWAYS provide a justification block for every ACCEPTED DEVIATION** — undocumented deviations are FAIL
