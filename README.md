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

## Requirements

- [Claude Code](https://claude.ai/code)
- [oh-my-claudecode](https://github.com/ohmyclaudecode/ohmyclaudecode) with `/ralph`
- [browser-pilot](https://www.npmjs.com/package/@yqi96/browser-pilot) (for paper fetching and web retrieval)
- Python + `uv` (for fetch-paper script)
