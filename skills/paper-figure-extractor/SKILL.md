---
name: paper-figure-extractor
description: Extract a figure from a paper PDF at high resolution using pymupdf + PIL. Renders the page at 3x zoom (~216 dpi), crops out page headers/footers, and saves as PNG. Use for side-by-side comparison during paper reproduction.
argument-hint: "<pdf_path> <page_number> [output_path] [--crop=top|bottom|full]"
user-invocable: true
context: fork
agent: general-purpose
allowed-tools: Bash Read Write
---
$ARGUMENTS

# Paper Figure Extractor Skill

Extract a specific page/figure from a paper PDF as a high-resolution PNG.
Uses **pymupdf** for rendering and **PIL** for smart cropping of headers/footers.

## When to Activate

- User says "extract figure", "save figure from pdf", "figure from paper", "crop figure"
- User says "原图保存" or wants to save the original figure for comparison
- Step in reproduction pipeline: extract reference figure before plotting your own

## Arguments

```
/paper-figure-extractor <pdf_path> <page_number> [output_path] [--crop=top|bottom|full]
```

- `pdf_path` — path to the PDF file (e.g. `paper.pdf`)
- `page_number` — 1-indexed page number containing the figure (e.g. `20`)
- `output_path` — where to save PNG (defaults to `figures/original_page{N}.png`)
- `--crop=top` — keep upper half of page (figures in top half)
- `--crop=bottom` — keep lower half of page (figures in bottom half)
- `--crop=full` — keep full page minus header/footer chrome (default)

## Workflow

### Step 1 — Render page at 3x zoom

```python
import fitz  # pymupdf
doc = fitz.open(pdf_path)
page = doc[page_num - 1]  # convert to 0-indexed
mat = fitz.Matrix(3, 3)   # 3x zoom → ~216 dpi
pix = page.get_pixmap(matrix=mat)
pix.save(full_page_path)
```

### Step 2 — Crop with PIL to remove page chrome

```python
from PIL import Image
img = Image.open(full_page_path)
w, h = img.size

# Full page minus header/footer (default --crop=full):
cropped = img.crop((0, int(h * 0.05), w, int(h * 0.95)))

# Upper figure only (--crop=top):
upper = img.crop((0, int(h * 0.05), w, int(h * 0.60)))

# Lower figure only (--crop=bottom):
lower = img.crop((0, int(h * 0.40), w, int(h * 0.95)))
```

Crop ratios:
- Top header (page number + author line): ~5% of page height
- Bottom footer (journal download disclaimer): ~5% of page height
- Upper half figure region: rows 5%–60%
- Lower half figure region: rows 40%–95%

### Step 3 — Save and report

Save the cropped PNG to `output_path`. Report:
```
✓ Figure extracted: {output_path}
  Source: {pdf_path} page {page_number}
  Size: {W}×{H} px (~{dpi} dpi)
  Crop mode: {full|top|bottom}
```

### Step 4 — Verify

Read the saved PNG visually to confirm the crop is correct and the figure content is visible.

## Complete Script

Run with uv (no install needed):

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
mat = fitz.Matrix(3, 3)
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

## Output Naming Convention

```
figures/original_{figure_name}.png
```

Examples:
- `figures/original_figure4.png`
- `figures/original_figure1b.png`

## Examples

```bash
# Extract Figure 4 (top half of page 20) from paper
uv run --with pymupdf --with pillow script.py \
  paper.pdf 20 figures/original_figure4.png --crop=top

# Extract full page 5 (minus chrome)
uv run --with pymupdf --with pillow script.py \
  paper.pdf 5 figures/original_figure1.png --crop=full

# Extract lower figure on page 8
uv run --with pymupdf --with pillow script.py \
  paper.pdf 8 figures/original_figure2b.png --crop=bottom
```

## Notes

- **Dependencies**: `pymupdf` (fitz) and `pillow` (PIL) — install via `uv run --with pymupdf --with pillow`
- **Resolution**: 3× zoom on a standard 72 dpi PDF page → ~216 dpi output
- **Crop ratios**: adjust `0.05`/`0.95` if header/footer is larger (e.g. 0.08/0.92 for dense headers)
- **Page index**: pymupdf uses 0-indexed pages; this skill accepts 1-indexed (human-readable)
- **Intermediate file**: tmp PNG is deleted after cropping; only the final cropped PNG is kept
- **Purpose**: side-by-side visual comparison between original paper figure and your reproduced plot
