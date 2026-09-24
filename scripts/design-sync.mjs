import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const destination = join(root, 'design-contract');
const hash = (b) => createHash('sha256').update(b).digest('hex');
const mode = process.argv[2] ?? 'check';
if (mode === 'sync') {
  const source = resolve(process.argv[3] ?? '../design');
  const revision = process.argv[4] ?? execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['-C', source, 'status', '--porcelain'], { encoding: 'utf8' }).trim();
  if (dirty) throw new Error('Commit the design source before adoption');
  const names = ['tokens/responsive.json', 'tokens/tokens.css'];
  const entries = {};
  for (const path of names) {
    const data = execFileSync('git', ['-C', source, 'show', `${revision}:${path}`]);
    mkdirSync(join(destination, 'tokens'), { recursive: true });
    writeFileSync(join(destination, path), data);
    entries[`design-contract/${path}`] = hash(data);
  }
  const previous = existsSync(join(destination, 'lock.json'))
    ? JSON.parse(readFileSync(join(destination, 'lock.json'), 'utf8')).files : {};
  for (const path of Object.keys(previous)) {
    const file = resolve(root, path);
    if (!file.startsWith(destination + '/')) throw new Error('Invalid previous artifact path');
    if (!entries[path]) rmSync(file, { force: true });
  }
  writeFileSync(join(destination, 'lock.json'), JSON.stringify({ repository: 'viptv-org/design', revision, files: entries }, null, 2) + '\n');
  writeFileSync(join(root, 'DESIGN_REF'), revision + '\n');
  console.log(`Imported design tokens ${revision}`);
} else if (mode === 'check') {
  const lock = JSON.parse(readFileSync(join(destination, 'lock.json'), 'utf8'));
  if (lock.repository !== 'viptv-org/design' || !/^[a-f0-9]{40}$/.test(lock.revision) || readFileSync(join(root, 'DESIGN_REF'), 'utf8').trim() !== lock.revision) throw new Error('Design pin mismatch');
  for (const [path, expected] of Object.entries(lock.files)) {
    const file = resolve(root, path);
    if (!file.startsWith(destination + '/') || !existsSync(file) || hash(readFileSync(file)) !== expected) throw new Error(`Design artifact mismatch: ${path}`);
  }
  const inspect = (dir) => { for (const entry of readdirSync(dir, { withFileTypes: true })) { const file = join(dir, entry.name); if (entry.isDirectory()) { if (relative(root, file) !== 'design-contract/link-tv') inspect(file); } else if (entry.name !== 'lock.json' && !lock.files[relative(root, file)]) throw new Error(`Unpinned design artifact: ${relative(root, file)}`); } };
  if (existsSync(destination)) inspect(destination);
  console.log(`Design token integrity passed: ${lock.revision}`);
} else throw new Error('Use sync <design-checkout> [revision] or check');
