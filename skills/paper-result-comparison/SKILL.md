---
name: paper-result-comparison
description: Structured comparison of all reproduced results against the original paper. Called after ralph execution completes (Step 4 of reproduce-paper-workflow). Covers figures, tables, quantitative conclusions, and qualitative conclusions. Includes internal figure extraction and visual QA. Never fabricates values — missing artifacts = BLOCKED, not assumed.
argument-hint: "--dir=<path>"
user-invocable: true
context: fork
agent: general-purpose
allowed-tools: Bash Read Write
---
$ARGUMENTS

# Paper Result Comparison Skill

Structured post-execution result comparison for scientific paper reproduction. Called after all ralph PRD stories pass (Step 4 of `reproduce-paper-workflow`). Compares every result-type item identified in `process_checklist.md` against the paper. Includes built-in figure extraction (pymupdf) and figure QA (structured visual diff).

## When to Activate

- Step 4 of `reproduce-paper-workflow` (automatic)
- User says "compare results", "result QA", "结果对比", after completing ralph execution

## Arguments

```
/paper-result-comparison --dir=<path>
```

- `--dir` — working directory containing `process_checklist.md`, `paper_access_log.md`, and `artifacts/`

---

## Prerequisites

Before running this skill, confirm:
- All ralph PRD stories have `passes: true`
- `process_checklist.md` exists and all `result`-type steps have `status: complete` and a populated `artifact_path`
- Original paper PDF is accessible at the path recorded in `paper_access_log.md`

If any result-type step has `status: fail` or `status: blocked` or an empty `artifact_path`, mark that result item as **BLOCKED** in the report — do not attempt to compare a missing artifact.

---

## Procedure

### 1. Read the result inventory

Read `<dir>/process_checklist.md` and collect all steps with `type: result`. Group by result type:
- **figure** — produces a plot/chart/image
- **table** — produces a numeric table
- **quantitative conclusion** — produces a specific stated statistic (R²=0.82, n=671, p<0.05)
- **qualitative conclusion** — produces a theme, narrative finding, or conceptual claim
- **other** — any result type not covered above

### 2. Extract originals from paper

For each result item, read the corresponding section of the paper PDF and extract:
- **Figures**: extract the original figure from the PDF using the internal figure extraction procedure (see below)
- **Tables**: the exact numeric values as stated in the paper
- **Quantitative conclusions**: the exact statistic as stated in the paper text
- **Qualitative conclusions**: the exact claim or theme as stated in the paper text

### 3. Compare each item

For each result item, apply the appropriate comparison method (see sections below).

### 4. Write report

Write `<dir>/result_comparison_report.md` with all comparison results (see output format below).

---

## Comparison Methods

### Figures

#### Step A — Extract original figure from paper PDF

Run the inline extraction script to save the original figure as a high-resolution PNG:

```bash
uv run --with pymupdf --with pillow - << 'EOF'
import sys
import fitz
from PIL import Image
import os

pdf_path = sys.argv[1]
page_num = int(sys.argv[2])
output_path = sys.argv[3] if len(sys.argv) > 3 else f"figures/original_page{page_num}.png"
crop_mode = "full"
for arg in sys.argv[4:]:
    if arg.startswith("--crop="):
        crop_mode = arg.split("=", 1)[1]

os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
tmp_path = output_path + ".tmp.png"

doc = fitz.open(pdf_path)
page = doc[page_num - 1]
mat = fitz.Matrix(3, 3)   # 3× zoom → ~216 dpi
pix = page.get_pixmap(matrix=mat)
pix.save(tmp_path)

img = Image.open(tmp_path)
w, h = img.size

if crop_mode == "top":
    box = (0, int(h * 0.05), w, int(h * 0.60))
elif crop_mode == "bottom":
    box = (0, int(h * 0.40), w, int(h * 0.95))
else:  # full
    box = (0, int(h * 0.05), w, int(h * 0.95))

cropped = img.crop(box)
cropped.save(output_path)
os.remove(tmp_path)

cw, ch = cropped.size
print(f"✓ Figure extracted: {output_path}")
print(f"  Source: {pdf_path} page {page_num}")
print(f"  Size: {cw}×{ch} px (~216 dpi)")
print(f"  Crop mode: {crop_mode}")
EOF
```

Pass: `pdf_path page_number output_path [--crop=top|bottom|full]`

Crop modes:
- `--crop=full` (default) — full page minus header/footer chrome (rows 5%–95%)
- `--crop=top` — upper figure region (rows 5%–60%)
- `--crop=bottom` — lower figure region (rows 40%–95%)

Read the saved PNG visually to confirm the crop is correct.

#### Step B — Visual comparison (structured diff)

Use the Read tool on both image files simultaneously (multimodal vision). Check features in priority order — **stop at first CRITICAL mismatch and flag immediately**:

**a. AXIS RANGES (Priority: CRITICAL)**

| Check | How to identify |
|-------|----------------|
| X-axis min/max | Read tick labels at left and right edges |
| Y-axis min/max | Read tick labels at top and bottom edges |
| Axis direction | Verify ascending/descending matches paper |
| Tick spacing | Major tick interval matches? |

Common failure: auto-scaling stretches axis when outlier points exist. Fix via explicit `x_min`/`x_max`/`y_min`/`y_max` in `parameters.json`.

**b. LEGEND LABELS (Priority: HIGH)**

Check dataset/series names match paper's figure caption exactly, including units and notation.

**c. COLOR SCHEME (Priority: HIGH)**

Verify expected colors by checking the paper's figure captions and Methods section — do not assume any specific color convention.

**d. DATA DENSITY (Priority: MEDIUM)**

Roughly same number of data points visible in the same region? Any obviously missing or extra datasets?

**e. ERROR BARS (Priority: MEDIUM)**

X/Y error bars present? Magnitude looks similar? Cap style matches?

**f. CURVE STYLING (Priority: LOW)**

Line width, fill style, marker shape.

#### Step C — Produce per-figure diff table

```markdown
### Figure QA: {figure_id}

**Original**: {pdf_path}:{page_number} (extracted to {original_png_path})
**Reproduced**: {artifact_path}

| Feature | Original | Reproduced | Priority | Fix |
|---------|----------|------------|----------|-----|
| X-axis range | 0–100 | 0–120 | CRITICAL | Set x_max=100 in parameters.json |
| Y-axis range | 0.0–1.0 | 0.0–1.2 | CRITICAL | Set y_min=0.0, y_max=1.0 in parameters.json |
| Legend label | "Model A (val=0.95)" | "Model A" | HIGH | Add notation to legend label |
| Color scheme | blue (#0055CC) | red | HIGH | Change curve_color to '#0055CC' |
| Data density | ~80 points | ~80 points | OK | — |
| Error bars | both x and y | y only | MEDIUM | Enable x_error_bars=true |
| Line width | 1.5pt | 2pt | LOW | Set linewidth=1.5 |
```

#### Step D — Fix and iterate

For each CRITICAL/HIGH issue:
1. Attempt fix (update `parameters.json`, fix parsing, re-read the paper Methods/caption)
2. Re-run reproduce script, re-compare
3. If still unresolved: evaluate ACCEPTED DEVIATION or FAIL — never silently accept

**Axis range fix** (most common):
```json
// parameters.json
{
  "x_min": 0,
  "x_max": 100,
  "y_min": 0.0,
  "y_max": 1.0
}
```

Then re-run: `uv run reproduce.py`

Iterate until all CRITICAL and HIGH issues are resolved or explicitly classified.

#### Step E — Per-figure verdict

Three possible outcomes per figure:
- **PASS** — all CRITICAL and HIGH priority differences resolved
- **ACCEPTED DEVIATION** — unresolved items with full justification block (cause, impact, substitutability)
- **FAIL** — unresolved CRITICAL/HIGH items that are scientifically significant

**Figure comparison lessons:**
- Check axis range FIRST — mismatched ranges make identical data look different
- Y-axis auto-scale: even 1–2 outlier points expand the axis significantly
- Paper figures often show a zoomed window; reproduce.py may default to full range
- Fix axis before comparing other visual properties
- For multi-panel figures, compare panels one at a time

### Tables

For each table:
1. Read the paper's table values exactly
2. Read the reproduced table artifact (CSV, printed output, or generated table file)
3. Compare value by value for every numeric cell

**Tolerance**: exact match unless the paper's Methods imply rounding. Document any rounding assumption.

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

Write `<dir>/result_comparison_report.md`:

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
| Table 3 | FLOPs | 4.1G | 4.1G | PASS |

{For each ACCEPTED DEVIATION or FAIL, add explanation block}

---

## Quantitative Conclusions

| Claim | Paper states | Reproduced | Verdict |
|-------|-------------|------------|---------|
| Q1 | "Model achieves 76.1% top-1 accuracy" | 75.8% reproduced | ACCEPTED DEVIATION |

---

## Qualitative Conclusions

| Conclusion ID | Paper states | Reproduced finding | Verdict |
|--------------|-------------|-------------------|---------|
| L1 | "Residual connections enable training of very deep networks" | Training loss decreases smoothly with skip connections | PASS |

---

## Other Results

{Any result types not covered above — document comparison method and verdict}

---

## Paper-Level Assessment

**Summary**: {N_pass} PASS, {N_dev} ACCEPTED DEVIATION, {N_fail} FAIL, {N_blocked} BLOCKED

**Overall assessment**:
{Narrative paragraph: evaluate reproduction fidelity, scientific significance of any deviations,
whether the paper's main claims are supported by the reproduction, and the overall reproducibility
verdict. Note any systematic issues. Do not give a single binary grade — explain the nuance.}
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
