# paper-reproduce

Scientific paper reproduction skills for Claude Code — fetch papers, drive the reproduction workflow, and compare results. Works with any scientific paper across any research domain.

## Install

```bash
npx @yqi96/paper-reproduce@latest
```

This copies all skills to `~/.claude/commands/`, installs the `paper-alignment-verifier` agent to `~/.claude/agents/`, and installs the fetch script to `~/.paper-reproduce/scripts/`. It also guides you through installing OMC and browser-pilot if not already present.

## Uninstall

```bash
npx --package=@yqi96/paper-reproduce@latest paper-reproduce-uninstall
```

## Skills included

| Skill | Invoke | Description |
|-------|--------|-------------|
| `fetch-paper` | `/fetch-paper <doi> [output_dir]` | Download paper PDF via Sci-Hub |
| `reproduce-paper-workflow` | `/reproduce-paper-workflow <doi> <path>` | Universal 7-step reproduction pipeline |
| `paper-result-comparison` | `/paper-result-comparison <path>` | Structured result comparison after ralph execution |

## Agents included

| Agent | Description |
|-------|-------------|
| `paper-alignment-verifier` | Per-story process auditor — verifies each execution step matches the paper's Methods section |

## Typical workflow

```
/reproduce-paper-workflow 10.1038/s41586-021-03819-2 ~/papers/alphafold
```

This runs the full pipeline:

1. **Step 0** — `/fetch-paper` downloads the PDF
2. **Step 1** — Process extraction → `process_checklist.md`
3. **Step 2** — Human confirms checklist
4. **Step 3** — Ralph executes each story; `paper-alignment-verifier` audits each step against the paper before marking complete
5. **Step 4** — `/paper-result-comparison` compares all results against the paper
6. **Step 5** — `README.md` written

## Requirements

- [Claude Code](https://claude.ai/code)
- [oh-my-claudecode](https://github.com/ohmyclaudecode/ohmyclaudecode) with `/ralph`
- [browser-pilot](https://www.npmjs.com/package/@yqi96/browser-pilot) (for paper fetching and web retrieval)
- Python + `uv` (for fetch-paper script)
