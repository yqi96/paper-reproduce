#!/usr/bin/env node
import fs from 'fs';
import os from 'os';
import path from 'path';

const homeDir = os.homedir();

function green(s: string) { return `\x1b[32m${s}\x1b[0m`; }

const SKILLS = [
  'fetch-paper',
  'paper-figure-extractor',
  'paper-result-comparison',
  'reproduce-paper-workflow',
  'scientific-figure-qa',
  'web-scout',
];

function del(filePath: string, label: string) {
  try {
    fs.rmSync(filePath, { force: true });
    console.log(green(`  ✓ removed: ${label}`));
  } catch {}
}

console.log('\npaper-reproduce uninstaller\n');

// Remove skills from ~/.claude/commands/
for (const skill of SKILLS) {
  del(path.join(homeDir, '.claude', 'commands', `${skill}.md`), `commands/${skill}.md`);
}

// Remove agents from ~/.claude/agents/
del(path.join(homeDir, '.claude', 'agents', 'paper-alignment-verifier.md'), 'agents/paper-alignment-verifier.md');

// Remove scripts
del(path.join(homeDir, '.paper-reproduce', 'scripts', 'fetch_paper.py'), 'scripts/fetch_paper.py');
del(path.join(homeDir, '.paper-reproduce', 'scripts'), 'scripts/');
del(path.join(homeDir, '.paper-reproduce'), '.paper-reproduce/');

console.log(green('\nDone.'));
