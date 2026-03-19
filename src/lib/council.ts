import chalk from 'chalk';
import inquirer from 'inquirer';
import { getAllAvailableProviders, getAISuggestion } from './ai.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Perspective {
  providerName: string;
  model: string;
  response: string;
  error?: string;
}

export interface CouncilSession {
  originalPrompt: string;
  rounds: Round[];
}

interface Round {
  feedback?: string;        // user feedback that triggered this round (undefined = first round)
  perspectives: Perspective[];
}

// ─── Core ─────────────────────────────────────────────────────────────────────

/**
 * Broadcast a prompt to all available providers in parallel.
 * Failed providers are included with their error rather than crashing.
 */
export async function broadcastToCouncil(prompt: string): Promise<Perspective[]> {
  const providers = await getAllAvailableProviders();

  if (providers.length === 0) {
    throw new Error('No AI providers available. Run hermes config setup.');
  }

  const results = await Promise.allSettled(
    providers.map(async p => {
      const response = await p.complete(prompt);
      return { providerName: p.name, model: p.model, response } as Perspective;
    })
  );

  return results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { providerName: providers[i].name, model: providers[i].model, response: '', error: r.reason?.message ?? 'Unknown error' }
  );
}

/**
 * Ask the best available provider to synthesize a set of perspectives.
 */
export async function synthesizePerspectives(
  originalPrompt: string,
  perspectives: Perspective[],
  userFeedback?: string
): Promise<string> {
  const valid = perspectives.filter(p => !p.error);
  if (valid.length === 0) throw new Error('No valid perspectives to synthesize');
  if (valid.length === 1) return valid[0].response;

  const perspectiveBlock = valid
    .map(p => `### ${p.providerName} (${p.model})\n${p.response}`)
    .join('\n\n');

  const feedbackLine = userFeedback
    ? `\nUser feedback to incorporate: "${userFeedback}"\n`
    : '';

  const prompt = `You are synthesizing advice from multiple AI assistants into one clear, actionable recommendation.

Original request: "${originalPrompt}"
${feedbackLine}
Each assistant's perspective:

${perspectiveBlock}

Synthesize these into a single, concise, actionable response. Where they agree, state the consensus confidently. Where they differ, explain the trade-off briefly and make a clear recommendation. Do not attribute individual opinions.`;

  return getAISuggestion(prompt);
}

// ─── Interactive council UI ───────────────────────────────────────────────────

/**
 * Run a full interactive council session.
 * Broadcasts the prompt, shows perspectives, and loops until the user accepts or exits.
 * Returns the final accepted text, or null if skipped.
 */
export async function runCouncilSession(
  prompt: string,
  options: { label?: string } = {}
): Promise<string | null> {
  const session: CouncilSession = { originalPrompt: prompt, rounds: [] };

  console.log(
    '\n  ' + chalk.bold('Council') +
    (options.label ? chalk.dim(` — ${options.label}`) : '') + '\n'
  );

  let currentPrompt = prompt;
  let round = 0;

  while (true) {
    round++;
    process.stdout.write(chalk.dim(`  Consulting council${round > 1 ? ` (round ${round})` : ''}...`));

    const perspectives = await broadcastToCouncil(currentPrompt);
    session.rounds.push({ feedback: round > 1 ? currentPrompt : undefined, perspectives });

    // Clear the "consulting" line
    process.stdout.write('\r' + ' '.repeat(50) + '\r');

    // Display perspectives
    displayPerspectives(perspectives);

    // Build action choices
    const validPerspectives = perspectives.filter(p => !p.error);
    const choices: Array<{ name: string; value: string }> = [];

    // Accept individual
    validPerspectives.forEach((p, i) => {
      choices.push({ name: `Accept  [${i + 1}] ${p.providerName}`, value: `accept:${i}` });
    });

    // Synthesize (only when 2+ valid)
    if (validPerspectives.length > 1) {
      choices.push({ name: 'Synthesize  — have the council agree on one answer', value: 'synthesize' });
    }

    choices.push({ name: 'Refine  — give feedback and re-ask the council', value: 'refine' });
    choices.push({ name: 'Follow-up  — ask the council a new question', value: 'followup' });
    choices.push({ name: 'Exit  — discard', value: 'exit' });

    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices,
    }]);

    if (action === 'exit') return null;

    if (action.startsWith('accept:')) {
      const idx = parseInt(action.split(':')[1], 10);
      return validPerspectives[idx].response;
    }

    if (action === 'synthesize') {
      process.stdout.write(chalk.dim('  Synthesizing...\r'));
      const synthesis = await synthesizePerspectives(prompt, perspectives);
      process.stdout.write(' '.repeat(30) + '\r');

      console.log('\n' + chalk.dim('  ─'.repeat(27)));
      console.log('  ' + chalk.bold.cyan('Synthesis'));
      console.log(chalk.dim('  ─'.repeat(27)));
      wrapText(synthesis).forEach(l => console.log('  ' + l));
      console.log(chalk.dim('  ─'.repeat(27)) + '\n');

      const { synthAction } = await inquirer.prompt([{
        type: 'list',
        name: 'synthAction',
        message: 'Use this synthesis?',
        choices: [
          { name: 'Yes, accept', value: 'accept' },
          { name: 'Refine further', value: 'refine' },
          { name: 'Exit', value: 'exit' },
        ],
      }]);

      if (synthAction === 'accept') return synthesis;
      if (synthAction === 'exit') return null;
      // fall through to refine
    }

    // Refine or follow-up
    const isFollowUp = action === 'followup';
    const { feedback } = await inquirer.prompt([{
      type: 'input',
      name: 'feedback',
      message: isFollowUp ? 'Your question:' : 'Your feedback (what to change or add):',
      validate: (v: string) => v.trim().length > 0 || 'Please enter something',
    }]);

    if (isFollowUp) {
      currentPrompt = feedback.trim();
    } else {
      // Refine: re-ask with original context + all perspectives + user feedback
      const perspectiveContext = perspectives
        .filter(p => !p.error)
        .map(p => `[${p.providerName}]: ${p.response.slice(0, 500)}`)
        .join('\n\n');

      currentPrompt = `Original request: "${prompt}"

Previous perspectives from the council:
${perspectiveContext}

User feedback: "${feedback.trim()}"

Respond with an improved answer that addresses the feedback.`;
    }

    console.log();
  }
}

// ─── Display helpers ──────────────────────────────────────────────────────────

function displayPerspectives(perspectives: Perspective[]) {
  const valid = perspectives.filter(p => !p.error);
  const failed = perspectives.filter(p => p.error);

  perspectives.filter(p => !p.error).forEach((p, i) => {
    console.log(chalk.dim('  ─'.repeat(27)));
    console.log(`  ${chalk.bold.cyan(`[${i + 1}]`)} ${chalk.bold(p.providerName)} ${chalk.dim(p.model)}`);
    console.log(chalk.dim('  ─'.repeat(27)));
    wrapText(p.response).forEach(l => console.log('  ' + l));
    console.log();
  });

  if (failed.length > 0) {
    failed.forEach(p => {
      console.log(chalk.dim(`  [${p.providerName}] unavailable: ${p.error}`));
    });
    console.log();
  }

  if (valid.length === 0) {
    throw new Error('All council members failed to respond.');
  }
}

function wrapText(text: string, width = 72): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (paragraph.trim() === '') { lines.push(''); continue; }
    const words = paragraph.split(' ');
    let line = '';
    for (const word of words) {
      if ((line + ' ' + word).trim().length > width) {
        if (line) lines.push(line);
        line = word;
      } else {
        line = line ? line + ' ' + word : word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}
