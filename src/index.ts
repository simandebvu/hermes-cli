#!/usr/bin/env node

import { Command } from 'commander';
import { planCommand } from './commands/plan.js';
import { startCommand } from './commands/start.js';
import { wipCommand } from './commands/wip.js';
import { syncCommand } from './commands/sync.js';
import { conflictCommand } from './commands/conflict.js';
import { worktreeCommand } from './commands/worktree.js';
import { initCommand } from './commands/init.js';
import { statsCommand } from './commands/stats.js';
import { workflowCommand } from './commands/workflow.js';
import { configCommand } from './commands/config.js';
import { guardCommand } from './commands/guard.js';
import { updateCommand } from './commands/update.js';
import { commitCommand } from './commands/commit.js';
import { checkForUpdates, enforceMinimumVersion } from './lib/update-notifier.js';
import { printBanner, printWorkflows } from './lib/banner.js';

const program = new Command();
import { createRequire } from 'module';
const __require = createRequire(import.meta.url);
const { version: CURRENT_VERSION } = __require('../package.json');

program
  .name('hermes')
  .description('Intent-driven Git, guided by AI')
  .version(CURRENT_VERSION)
  .action(() => {
    printBanner(CURRENT_VERSION);
    printWorkflows();
    program.help();
  });

// Register commands
initCommand(program);
planCommand(program);
startCommand(program);
wipCommand(program);
syncCommand(program);
conflictCommand(program);
worktreeCommand(program);
statsCommand(program);
workflowCommand(program);
configCommand(program);
guardCommand(program);
updateCommand(program, CURRENT_VERSION);
commitCommand(program);

// Enforce minimum version before any command runs, then parse
enforceMinimumVersion(CURRENT_VERSION)
  .then(() => program.parseAsync())
  .then(() => checkForUpdates(CURRENT_VERSION))
  .catch(() => {});
