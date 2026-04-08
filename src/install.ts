#!/usr/bin/env node
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { execSync } from 'child_process';
import readline from 'node:readline/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillsDir = path.resolve(__dirname, '..', 'skills');
const agentsDir = path.resolve(__dirname, '..', 'agents');
const scriptsDir = path.resolve(__dirname, '..', 'skills', 'fetch-paper', 'scripts');
const homeDir = os.homedir();

function green(s: string) { return `\x1b[32m${s}\x1b[0m`; }
function red(s: string)   { return `\x1b[31m${s}\x1b[0m`; }

const SKILLS = [
  'fetch-paper',
  'paper-result-comparison',
  'reproduce-paper-workflow',
  'web-scout',
];

console.log('\npaper-reproduce installer\n');

let ok = 0;
let fail = 0;

// ── Install skills → ~/.claude/commands/ ────────────────────────────────────
const commandsDir = path.join(homeDir, '.claude', 'commands');
fs.mkdirSync(commandsDir, { recursive: true });

for (const skill of SKILLS) {
  const src = path.join(skillsDir, skill, 'SKILL.md');
  const dest = path.join(commandsDir, `${skill}.md`);
  try {
    fs.copyFileSync(src, dest);
    console.log(green(`  ✓ skill installed: ${skill}.md`));
    ok++;
  } catch (err) {
    console.error(red(`  ✗ failed to install ${skill}: ${(err as Error).message}`));
    fail++;
  }
}

// ── Install agents → ~/.claude/agents/ ──────────────────────────────────────
const claudeAgentsDir = path.join(homeDir, '.claude', 'agents');
fs.mkdirSync(claudeAgentsDir, { recursive: true });

for (const file of fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'))) {
  try {
    fs.copyFileSync(path.join(agentsDir, file), path.join(claudeAgentsDir, file));
    console.log(green(`  ✓ agent installed: ${file}`));
    ok++;
  } catch (err) {
    console.error(red(`  ✗ failed to install agent ${file}: ${(err as Error).message}`));
    fail++;
  }
}

// ── Install scripts → ~/.paper-reproduce/scripts/ ───────────────────────────
const destScriptsDir = path.join(homeDir, '.paper-reproduce', 'scripts');
fs.mkdirSync(destScriptsDir, { recursive: true });

for (const file of fs.readdirSync(scriptsDir).filter(f => f.endsWith('.py'))) {
  const dest = path.join(destScriptsDir, file);
  try {
    fs.copyFileSync(path.join(scriptsDir, file), dest);
    fs.chmodSync(dest, 0o755);
    console.log(green(`  ✓ script installed: ~/.paper-reproduce/scripts/${file}`));
    ok++;
  } catch (err) {
    console.error(red(`  ✗ failed to install script ${file}: ${(err as Error).message}`));
    fail++;
  }
}

console.log('');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// ── Install OMC (oh-my-claudecode) ──────────────────────────────────────────
let omcInstalled = false;
try {
  execSync('omc --version', { stdio: 'ignore' });
  omcInstalled = true;
} catch {}

if (omcInstalled) {
  console.log(green('  ✓ OMC (oh-my-claudecode) already installed, skipping'));
  ok++;
} else {
  const answer = await rl.question('  OMC (oh-my-claude-sisyphus) 未检测到，是否立即安装？[y/N] ');
  if (answer.trim().toLowerCase() === 'y') {
    try {
      execSync('npm i -g oh-my-claude-sisyphus@latest', { stdio: 'inherit' });
      console.log(green('  ✓ OMC installed'));
      ok++;
    } catch {
      console.error(red('  ✗ failed to install OMC'));
      fail++;
    }
  } else {
    console.log('  ⊘ OMC install skipped by user');
  }
}

// ── Install browser-pilot (skip if already configured) ───────────────────────
const claudeJson = path.join(homeDir, '.claude.json');
let bpAlreadyInstalled = false;
try {
  const cfg = JSON.parse(fs.readFileSync(claudeJson, 'utf8'));
  if (cfg?.mcpServers?.browser) bpAlreadyInstalled = true;
} catch {}

if (bpAlreadyInstalled) {
  console.log(green('  ✓ browser-pilot already configured, skipping'));
  ok++;
} else {
  const answer = await rl.question('  browser-pilot (@yqi96/browser-pilot) 未检测到，是否立即安装？[y/N] ');
  if (answer.trim().toLowerCase() === 'y') {
    try {
      execSync('npx --package=@yqi96/browser-pilot@latest browser-pilot-install', { stdio: 'inherit' });
      console.log(green('  ✓ browser-pilot installed'));
      ok++;
    } catch {
      console.error(red('  ✗ failed to install browser-pilot'));
      fail++;
    }
  } else {
    console.log('  ⊘ browser-pilot install skipped by user');
  }
}

// Close readline after all prompts
rl.close();

console.log('');
if (fail === 0) {
  console.log(green(`Done: ${ok} items installed successfully.`));
  console.log('\nUsage: /fetch-paper, /reproduce-paper-workflow, /paper-result-comparison, etc.');
  process.exit(0);
} else {
  console.error(red(`Done with errors: ${ok} ok, ${fail} failed.`));
  process.exit(1);
}
