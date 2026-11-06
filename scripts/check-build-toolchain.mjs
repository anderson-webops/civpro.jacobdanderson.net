import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifyBuildToolchain } from './build-toolchain-state.mjs';

const receipt = verifyBuildToolchain();
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
assert.equal(manifest.packageManager, `npm@${receipt.versions.npm}`);
assert.equal(manifest.engines.node, `>=${receipt.node} <27`);
assert.equal(manifest.engines.npm, `>=${receipt.versions.npm} <13`);
for (const filename of ['.node-version', '.nvmrc']) {
  assert.equal(readFileSync(new URL(`../${filename}`, import.meta.url), 'utf8').trim(), receipt.node);
}
assert.equal(Object.keys(manifest.dependencies || {}).length, 0);
assert.deepEqual(Object.keys(manifest.devDependencies || {}).sort(), ['@axe-core/playwright', 'playwright']);
process.stdout.write(`${JSON.stringify(receipt)}\n`);
