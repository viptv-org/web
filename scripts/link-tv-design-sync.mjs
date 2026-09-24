import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const target = join(root, 'design-contract/link-tv');
const sourcePath = 'viptv-design-system/tokens/tokens.css';
const digest = data => createHash('sha256').update(data).digest('hex');
const mode = process.argv[2] ?? 'check';

if (mode === 'sync') {
  const design = resolve(process.argv[3] ?? '../design');
  const revision = process.argv[4] ?? execFileSync('git', ['-C', design, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error('Pass a full design commit SHA');
  if (execFileSync('git', ['-C', design, 'status', '--porcelain'], { encoding: 'utf8' }).trim())
    throw new Error('Commit the design source before adoption');
  const source = execFileSync('git', ['-C', design, 'show', `${revision}:${sourcePath}`], { encoding: 'utf8' });
  const variables = source.match(/:root\s*\{[^}]*\}/);
  if (!variables) throw new Error('The design token CSS has no root variables');
  const css = `/* Generated from ${sourcePath} at ${revision}. Do not edit. */\n${variables[0]}\n`;
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, 'tokens.css'), css);
  writeFileSync(join(target, 'lock.json'), JSON.stringify({ repository: 'viptv-org/design', revision, sourcePath, sha256: digest(css) }, null, 2) + '\n');
  console.log(`Imported Link TV tokens from ${revision}`);
} else if (mode === 'check') {
  const lock = JSON.parse(readFileSync(join(target, 'lock.json'), 'utf8'));
  const css = readFileSync(join(target, 'tokens.css'));
  if (lock.repository !== 'viptv-org/design' || lock.sourcePath !== sourcePath || !/^[a-f0-9]{40}$/.test(lock.revision) || digest(css) !== lock.sha256)
    throw new Error('Link TV design snapshot mismatch');
  console.log(`Link TV design integrity passed: ${lock.revision}`);
} else {
  throw new Error('Use sync <design-checkout> <full-revision> or check');
}
