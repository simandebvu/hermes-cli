import { Command } from 'commander';
import { analyzeCopilotGitState, getCopilotSuggestion } from '../lib/copilot.js';
import { getRepoState, getConflictedFiles, executeGitCommand } from '../lib/git.js';
import { displayConflictExplanation, displayStep } from '../lib/display.js';
import inquirer from 'inquirer';
import { readFile, writeFile } from 'fs/promises';

export function conflictCommand(program: Command) {
  const conflict = program
    .command('conflict')
    .description('Understand and resolve merge conflicts');

  conflict
    .command('explain')
    .description('Understand why a conflict exists')
    .action(async () => {
      try {
        console.log('🔍 Analyzing conflicts...\n');

        const repoState = await getRepoState();
        const conflictedFiles = await getConflictedFiles();

        if (conflictedFiles.length === 0) {
          console.log('✅ No conflicts detected');
          return;
        }

        // Get AI explanation from Copilot CLI
        const explanation = await analyzeCopilotGitState(
          { ...repoState, conflictedFiles },
          `Explain these merge conflicts: ${conflictedFiles.join(', ')}. For each file, explain what each side is trying to do and recommend a resolution strategy.`
        );

        displayConflictExplanation(explanation, conflictedFiles);
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  conflict
    .command('apply')
    .description('Resolve conflicts with guidance')
    .action(async () => {
      try {
        console.log('🔧 Resolving conflicts...\n');

        const conflictedFiles = await getConflictedFiles();

        if (conflictedFiles.length === 0) {
          console.log('✅ No conflicts to resolve');
          return;
        }

        for (const file of conflictedFiles) {
          console.log(`\n📄 ${file}`);

          // Read the conflicted file content
          let fileContent: string;
          try {
            fileContent = await readFile(file, 'utf-8');
          } catch (error) {
            console.log(`⚠️  Could not read ${file}, skipping...`);
            continue;
          }

          const prompt = `
Here is a file with Git merge conflict markers:

${fileContent}

Analyze the conflict and provide a resolved version of the file without conflict markers.
Ensure the resolution makes logical sense and preserves the intent of both sides where possible.
Return ONLY the resolved file content, no explanations.
`;

          const resolution = await getCopilotSuggestion(prompt, { silent: true });

          // Show preview of resolution
          console.log('\n💡 Proposed resolution preview:');
          console.log('─'.repeat(50));
          console.log(resolution.split('\n').slice(0, 20).join('\n'));
          if (resolution.split('\n').length > 20) {
            console.log(`... (${resolution.split('\n').length - 20} more lines)`);
          }
          console.log('─'.repeat(50));

          const { action } = await inquirer.prompt([
            {
              type: 'list',
              name: 'action',
              message: `How would you like to handle ${file}?`,
              choices: [
                { name: 'Accept proposed resolution', value: 'accept' },
                { name: 'Edit manually', value: 'edit' },
                { name: 'Skip this file', value: 'skip' },
              ],
            },
          ]);

          if (action === 'accept') {
            displayStep(`Applying resolution to ${file}`);
            await writeFile(file, resolution, 'utf-8');
            await executeGitCommand(`git add "${file}"`);
            console.log('✅ Resolved and staged');
          } else if (action === 'edit') {
            console.log('💡 Opening editor...');
            const editor = process.env.EDITOR || 'vim';
            await executeGitCommand(`${editor} "${file}"`);
            console.log('📝 File opened for manual editing');
          } else {
            console.log('⏭️  Skipped');
          }
        }

        console.log('\n💡 Remember to commit after resolving all conflicts');
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}
