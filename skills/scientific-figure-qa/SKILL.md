---
name: scientific-figure-qa
description: Compare original paper figures with reproduced figures. Outputs a structured diff table with prioritized fixes, then iterates via executor until all high-priority differences are resolved.
argument-hint: "<original_pdf_or_image> <reproduced_figure> [reproduce_script]"
user-invocable: true
context: fork
agent: general-purpose
allowed-tools: Bash Read Write
---
$ARGUMENTS

# Scientific Figure QA Skill

Structured visual comparison of original paper figures versus reproduced figures. Focuses on the most common reproduction failures: axis ranges, legend labels, color schemes, data density, error bars, and curve styling.

## When to Activate

- User says "figure qa", "对比原图", "figure comparison", "复现图差异", "visual comparison"
- Reproduced figure looks "roughly right" but details don't match the paper
- After running reproduce.py and wanting to verify fidelity

## Arguments

```
/scientific-figure-qa <original_pdf_or_image> <reproduced_figure> [reproduce_script]
```

- `original_pdf_or_image` — path to paper PDF (with page number, e.g. `paper.pdf:5`) or extracted PNG
- `reproduced_figure` — path to the reproduced figure PNG/PDF
- `reproduce_script` — optional path to reproduce.py (defaults to `reproduce.py` in CWD)

## Workflow

### Step 1 — Extract original figure (if PDF given)

If input is a PDF page, extract at 3× zoom for sharpness:

```python
import fitz  # pymupdf
doc = fitz.open("paper.pdf")
page = doc[page_number - 1]   # 0-indexed
mat = fitz.Matrix(3, 3)       # 3× zoom
pix = page.get_pixmap(matrix=mat)
pix.save("original_figure_extracted.png")
```

Then crop to the figure area if needed (use the full page if unsure).

### Step 2 — Read both images in parallel

Use the Read tool on both image files simultaneously (multimodal vision):

```
Read original_figure.png
Read reproduced_figure.png
```

Examine each image carefully before comparison.

### Step 3 — Structured comparison (priority order)

Check each feature in this order. **Stop at first HIGH-priority mismatch and flag immediately.**

#### a. AXIS RANGES (Priority: CRITICAL)

| Check | How to identify |
|-------|----------------|
| X-axis min/max | Read tick labels at left and right edges |
| Y-axis min/max | Read tick labels at top and bottom edges |
| Axis direction | Verify axis direction (ascending/descending) matches the paper's figures |
| Tick spacing | Major tick interval matches? |

Common failure: auto-scaling stretches axis 2× when outlier points exist outside the intended view window. Fix via `parameters.json` `x_min`/`x_max`/`y_min`/`y_max` fields.

#### b. LEGEND LABELS (Priority: HIGH)

| Check | How to identify |
|-------|----------------|
| Dataset/series names | Check paper's figure caption and legend for exact labels |
| Key curve names | Verify expected colors by checking the paper's figure captions and Methods section — do not assume any specific color convention |
| Number of legend entries | Count items in each legend |
| Legend position | Top-right, bottom-left, etc. |

#### c. COLOR SCHEME (Priority: HIGH)

Verify expected colors by checking the paper's figure captions and Methods section — do not assume any specific color convention.

| Element | How to verify |
|---------|--------------|
| Main curves | Check paper caption or Methods for described colors |
| Data points | Check paper — varies by dataset |
| Error bars | Usually same color as points, thinner |

#### d. DATA DENSITY (Priority: MEDIUM)

- Roughly same number of data points visible in the same region?
- Are there obvious missing datasets or extra datasets?

#### e. ERROR BARS (Priority: MEDIUM)

- X-error bars (if present) visible?
- Y-error bars (if present) visible?
- Magnitude looks similar?
- Cap style (with/without end caps)?

#### f. CURVE STYLING (Priority: LOW)

- Line width: main curve thin (1pt) vs thick (2pt)?
- Envelope: semi-transparent fill vs opaque band?
- Data points: filled circles vs open circles vs crosses?

### Step 4 — Output diff table

```markdown
## Figure QA Report

**Original**: {path}
**Reproduced**: {path}
**Date**: {ISO date}

### Diff Table

| Feature | Original | Reproduced | Priority | Fix |
|---------|----------|------------|----------|-----|
| X-axis range | 0–100 | 0–120 | CRITICAL | Set x_max=100 in parameters.json |
| Y-axis range | 0.0–1.0 | 0.0–1.2 | CRITICAL | Set y_min=0.0, y_max=1.0 in parameters.json |
| Legend: Model A | "Model A (val=0.95)" | "Model A" | HIGH | Add units/notation to legend label |
| Curve color | blue (#0055CC) | red | HIGH | Change curve_color to '#0055CC' |
| Data density | ~80 points | ~80 points | OK | — |
| Error bars | both x and y | y only | MEDIUM | Enable x_error_bars=true |
| Line width | 1.5pt | 2pt | LOW | Set linewidth=1.5 |

### Summary
- CRITICAL: 2 issues (axis ranges)
- HIGH: 2 issues (legend label, color)
- MEDIUM: 1 issue (error bars)
- LOW: 1 issue (line width)
- PASS: 1 check (data density)
```

### Step 5 — Fix and iterate

**Resolution protocol for each CRITICAL/HIGH issue:**
1. Attempt to fix (update `parameters.json`, fix parsing, re-read the paper Methods/caption)
2. Re-run `reproduce.py`, re-compare
3. If still unresolved after exhausting all options — evaluate and decide:
   - **ACCEPTED DEVIATION**: deviation is unavoidable (library version, platform float, original data updated), does NOT affect scientific conclusion, substitutability is justified → document fully
   - **FAIL**: deviation is scientifically significant and cannot be resolved → report honestly
4. Never silently accept — every unresolved item must have a written decision

For each CRITICAL/HIGH issue, implement the fix:

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

Then re-run the reproduce script:
```bash
python reproduce.py
# or
uv run reproduce.py
```

Re-read the output figure and repeat Step 3–4 until all CRITICAL and HIGH issues are resolved.

### Step 6 — Verdict

Three possible outcomes per figure:

```markdown
## QA Verdict: PASS ✓
All CRITICAL and HIGH priority differences resolved.
Remaining LOW issues: line width (cosmetic, acceptable).

## QA Verdict: ACCEPTED DEVIATION ⚠️
Unresolved items:
| Item | Cause | Impact on science | Substitutability |
|------|-------|-------------------|-----------------|
| colorbar tick spacing | matplotlib version renders differently | none — same data range | equivalent |

Resolution attempts: updated rcParams, tried explicit tick locator — renderer difference persists.
Decision: cosmetic only, scientific content unaffected.

## QA Verdict: FAIL ✗
Remaining CRITICAL: Y-axis range still mismatched (0.0–1.0 vs 0.0–1.2).
Attempts: checked parameters.json, re-read caption, re-ran script — mismatch persists.
Impact: key feature compressed and invisible. Scientifically significant.
Action required: further investigation needed before this reproduction can be accepted.
```

## Common Figure Comparison Lessons

- **Axis range first**: Check axis range FIRST before comparing visual appearance — mismatched ranges make identical data look different.
- **Y-axis auto-scaling**: Matplotlib's auto-scale stretches to fit ALL data including outliers. Even 1–2 points outside the intended range will expand the axis significantly. Always set explicit `y_min`/`y_max` matching the paper figure.
- **X-axis zoom**: Paper figures often show a zoomed window while reproduce.py defaults to a full range. The figure caption usually states the x-range explicitly.
- **Data source exactness**: Verify data source matches exactly — similar datasets with different preprocessing produce subtly different curves.
- **Legend labels**: Legend labels must match exactly, including units and notation.
- **Fix axis before other properties**: When axis range is wrong, fix it before comparing any other visual properties.

> **Domain-specific example (radiocarbon papers):** A spike visible in original but compressed/invisible in reproduction almost always means y-axis is too wide — fix the y-axis first.

## Notes

- Always compare at the same zoom level — resize windows to match if possible
- Check figure captions in the paper for explicit axis bounds before assuming from the image
- For multi-panel figures, compare panels one at a time
- If the reproduced figure has extra panels not in the original, that is a scope issue, not a QA issue
