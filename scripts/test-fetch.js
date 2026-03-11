// Test if fetch works in the bundled code
const PACKAGE_NAME = 'hermes-git';

async function testFetch() {
  try {
    console.log('Testing fetch...');
    const response = await fetch(`https://registry.npmjs.org/${PACKAGE_NAME}/latest`);
    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);

    if (response.ok) {
      const data = await response.json();
      console.log('Latest version:', data.version);
    }
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

testFetch();
