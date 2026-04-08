# paper-reproduce

Scientific paper reproduction skills for Claude Code — fetch papers, extract figures, drive the reproduction workflow, and compare results. Works with any scientific paper across any research domain.

## Skills included

| Skill | Invoke | Description |
|-------|--------|-------------|
| `fetch-paper` | `/fetch-paper <doi> [output_dir]` | Download paper PDF via Sci-Hub |
| `paper-figure-extractor` | `/paper-figure-extractor <pdf> <page> [output] [--crop=top\|bottom\|full]` | Extract figure from PDF at 216 dpi |
| `reproduce-paper-workflow` | `/reproduce-paper-workflow <paper_number> <doi>` | Universal 7-step reproduction pipeline |
| `paper-result-comparison` | `/paper-result-comparison <paper_number>` | Structured result comparison after ralph execution |
| `scientific-figure-qa` | `/scientific-figure-qa <original> <reproduced> [script]` | Visual diff of original vs reproduced figures |
| `web-scout` | `/web-scout <anchor> <what_to_find> [output_path]` | Deep browser-based information retrieval |

## Install

```bash
npx --package=@yqi96/paper-reproduce@latest paper-reproduce-install
```

This copies all skills to `~/.claude/commands/` and installs the fetch script to `~/.paper-reproduce/scripts/`.

## Uninstall

```bash
npx --package=@yqi96/paper-reproduce@latest paper-reproduce-uninstall
```

## Typical workflow

```
/reproduce-paper-workflow 65 10.1038/s41586-021-03819-2
```

This runs the full pipeline:

1. **Step 0** — `/fetch-paper` downloads the PDF
2. **Step 1** — Process extraction → `process_checklist.md`
3. **Step 2** — Human confirms checklist
4. **Step 3** — PRD generated for `/ralph`
5. **Step 4** — Ralph execution (agent + human steps)
6. **Step 5** — `/paper-result-comparison` compares all results
7. **Step 6** — `README.md` written

## Requirements

- Python + `uv` (for fetch-paper and figure extraction scripts)
- Claude Code with `/browser` skill (for web-scout)
- oh-my-claudecode with `/ralph` (for reproduce-paper-workflow Step 4)
