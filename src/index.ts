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

const program = new Command();

program
  .name('hermes')
  .description('🪽 Intent-driven Git, guided by AI')
  .version('0.2.3');

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

program.parse();
