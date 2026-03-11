import chalk from 'chalk';
import { readFileSync, existsSync } from 'fs';

// ANSI Shadow font — hand-crafted for HERMES
const ART_LINES = [
  '██╗  ██╗███████╗██████╗ ███╗   ███╗███████╗███████╗',
  '██║  ██║██╔════╝██╔══██╗████╗ ████║██╔════╝██╔════╝',
  '███████║█████╗  ██████╔╝██╔████╔██║█████╗  ███████╗',
  '██╔══██║██╔══╝  ██╔══██╗██║╚██╔╝██║██╔══╝  ╚════██║',
  '██║  ██║███████╗██║  ██║██║ ╚═╝ ██║███████╗███████║',
  '╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝╚══════╝',
];

// Gradient: top rows bright, bottom rows dim
const ROW_COLORS = [
  (s: string) => chalk.bold.cyanBright(s),
  (s: string) => chalk.bold.cyanBright(s),
  (s: string) => chalk.bold.cyan(s),
  (s: string) => chalk.bold.cyan(s),
  (s: string) => chalk.cyan(s),
  (s: string) => chalk.dim.cyan(s),
];

const ART_WIDTH = 52; // character width of the block text

export function printBanner(version: string): void {
  const wings = chalk.dim.cyan('~>))><');
  const tail  = chalk.dim.cyan('><((<~');

  console.log();
  console.log(`  ${wings}${'─'.repeat(ART_WIDTH - 14)}${tail}`);

  for (let i = 0; i < ART_LINES.length; i++) {
    console.log('  ' + ROW_COLORS[i](ART_LINES[i]));
  }

  const subtitle = 'intent-driven git';
  const versionLabel = chalk.dim(`v${version}`);
  const dot = chalk.dim('·');
  const padding = ' '.repeat(
    Math.max(0, Math.floor((ART_WIDTH - subtitle.length - version.length - 4) / 2))
  );

  console.log();
  console.log(`  ${padding}${chalk.dim(subtitle)}  ${dot}  ${versionLabel}`);
  console.log(`  ${wings}${'─'.repeat(ART_WIDTH - 14)}${tail}`);
  console.log();
}

// ─── Workflows section ────────────────────────────────────────────────────────

interface WorkflowEntry {
  name: string;
  description: string;
  custom?: boolean;
}

const BUILTIN_WORKFLOWS: WorkflowEntry[] = [
  { name: 'pr-ready',      description: 'Sync, rebase, push — ready for pull request' },
  { name: 'daily-sync',    description: 'Fetch + status check to start the day' },
  { name: 'quick-commit',  description: 'Stage changes and commit with AI message' },
];

function loadProjectWorkflows(): WorkflowEntry[] {
  try {
    if (!existsSync('.hermes/config.json')) return [];
    const config = JSON.parse(readFileSync('.hermes/config.json', 'utf-8'));
    const workflows = config?.workflows;
    if (!workflows || typeof workflows !== 'object') return [];
    return Object.entries(workflows)
      .filter(([name]) => !BUILTIN_WORKFLOWS.some((b) => b.name === name))
      .map(([name, steps]) => ({
        name,
        description: Array.isArray(steps) ? steps.join(' → ') : String(steps),
        custom: true,
      }));
  } catch {
    return [];
  }
}

export function printWorkflows(): void {
  const project = loadProjectWorkflows();
  const all = [...BUILTIN_WORKFLOWS, ...project];

  const nameWidth = Math.max(...all.map((w) => w.name.length)) + 2;

  console.log(chalk.bold('  Workflows'));
  console.log();

  for (const w of BUILTIN_WORKFLOWS) {
    const cmd = chalk.cyan(`hermes workflow ${w.name.padEnd(nameWidth)}`);
    console.log(`    ${cmd}  ${chalk.dim(w.description)}`);
  }

  if (project.length > 0) {
    console.log();
    console.log(chalk.dim('  Project-specific:'));
    for (const w of project) {
      const cmd = chalk.cyan(`hermes workflow ${w.name.padEnd(nameWidth)}`);
      console.log(`    ${cmd}  ${chalk.dim(w.description)}`);
    }
  }

  console.log();
}
