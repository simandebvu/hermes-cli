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
import { checkForUpdates } from './lib/update-notifier.js';

const program = new Command();
const CURRENT_VERSION = '0.2.4';

program
  .name('hermes')
  .description('🪽 Intent-driven Git, guided by AI')
  .version(CURRENT_VERSION);

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

// Check for updates (non-blocking)
checkForUpdates(CURRENT_VERSION).catch(() => {
  // Silently ignore errors
});

program.parse();
