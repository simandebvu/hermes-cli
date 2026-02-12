// Simulate what the update notifier does

import chalk from 'chalk';

function isNewerVersion(current, latest) {
  const currentParts = current.split('.').map(Number);
  const latestParts = latest.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    if (latestParts[i] > currentParts[i]) return true;
    if (latestParts[i] < currentParts[i]) return false;
  }

  return false;
}

console.log('\n🧪 Testing version comparison logic:\n');

const tests = [
  { current: '0.2.3', latest: '0.2.4', expected: true },
  { current: '0.2.3', latest: '0.3.0', expected: true },
  { current: '0.2.3', latest: '1.0.0', expected: true },
  { current: '0.2.3', latest: '0.2.3', expected: false },
  { current: '0.2.3', latest: '0.2.2', expected: false },
];

tests.forEach(test => {
  const result = isNewerVersion(test.current, test.latest);
  const status = result === test.expected ? '✅' : '❌';
  console.log(`${status} ${test.current} < ${test.latest}? ${result} (expected ${test.expected})`);
});

console.log('\n📋 Simulating update notification (what user will see):\n');

const currentVersion = '0.2.3';
const latestVersion = '0.2.5';

console.log(chalk.yellow('\n┌─────────────────────────────────────────────────────┐'));
console.log(chalk.yellow('│') + '  ' + chalk.bold('Update available!') + ' ' + chalk.dim(currentVersion) + ' → ' + chalk.green.bold(latestVersion) + '       ' + chalk.yellow('│'));
console.log(chalk.yellow('│') + '  Run: ' + chalk.cyan('npm install -g hermes-git@latest') + '  ' + chalk.yellow('│'));
console.log(chalk.yellow('└─────────────────────────────────────────────────────┘\n'));
