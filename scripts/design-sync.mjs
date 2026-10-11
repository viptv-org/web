import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { resolve, relative, join, sep } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const destination = join(root, 'design-contract');
// Avatar artwork is served from the dashboard origin (ADM-004).
const avatars = join(root, 'public', 'avatars');
const managed = (file) => file.startsWith(destination + sep) || file.startsWith(avatars + sep);
const hash = (b) => createHash('sha256').update(b).digest('hex');
const mode = process.argv[2] ?? 'check';
if (mode === 'sync') {
  const source = resolve(process.argv[3] ?? '../design');
  const revision = process.argv[4] ?? execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['-C', source, 'status', '--porcelain'], { encoding: 'utf8' }).trim();
  if (dirty) throw new Error('Commit the design source before adoption');
  const tree = execFileSync('git', ['-C', source, 'ls-tree', '-r', '--name-only', revision], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim().split('\n');
  // Plans moved under plans/backend-v2/; keep their contract paths stable.
  const located = (path) => tree.includes(path) ? path : `plans/backend-v2/${path}`;
  const imagePrefix = 'assets/roku/roku/images/';
  const mappings = [
    ...['ADMIN_V2.md', 'BACKEND_V2.md'].map((path) => [located(path), `design-contract/${path}`]),
    ...['viptv-design-system/tokens/tokens.json', 'viptv-design-system/tokens/tokens.css', 'assets/roku/roku/data/avatar-catalog.json'].map((path) => [path, `design-contract/${path}`]),
    ...tree.filter((path) => /^assets\/roku\/roku\/images\/avatar-(catalog|characters)\/[^/]+\.png$/.test(path))
      .map((path) => [path, `public/avatars/${path.slice(imagePrefix.length)}`]),
  ];
  const entries = {};
  for (const [from, path] of mappings) {
    let data = execFileSync('git', ['-C', source, 'show', `${revision}:${from}`], { maxBuffer: 16 * 1024 * 1024 });
    // Fonts are bundled locally. Derive the same tokens without a network import.
    if (path.endsWith('.css')) data = Buffer.from(data.toString().replace(/^@import url\('https:\/\/fonts\.googleapis\.com[^\n]*\);\r?\n/m, ''));
    mkdirSync(resolve(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), data);
    entries[path] = hash(data);
  }
  const previous = existsSync(join(destination, 'lock.json'))
    ? JSON.parse(readFileSync(join(destination, 'lock.json'), 'utf8')).files : {};
  for (const path of Object.keys(previous)) {
    const file = resolve(root, path);
    if (!managed(file)) throw new Error('Invalid previous artifact path');
    if (!entries[path]) rmSync(file, { force: true });
  }
  writeFileSync(join(destination, 'lock.json'), JSON.stringify({ repository: 'viptv-org/design', revision, files: entries }, null, 2) + '\n');
  writeFileSync(join(root, 'DESIGN_REF'), revision + '\n');
  console.log(`Imported design tokens and avatars ${revision}`);
} else if (mode === 'check') {
  const lock = JSON.parse(readFileSync(join(destination, 'lock.json'), 'utf8'));
  if (lock.repository !== 'viptv-org/design' || !/^[a-f0-9]{40}$/.test(lock.revision) || readFileSync(join(root, 'DESIGN_REF'), 'utf8').trim() !== lock.revision) throw new Error('Design pin mismatch');
  for (const [path, expected] of Object.entries(lock.files)) {
    const file = resolve(root, path);
    if (!managed(file) || !existsSync(file) || hash(readFileSync(file)) !== expected) throw new Error(`Design artifact mismatch: ${path}`);
  }
  const inspect = (dir) => { for (const entry of readdirSync(dir, { withFileTypes: true })) { const file = join(dir, entry.name); const path = relative(root, file).split(sep).join('/'); if (entry.isDirectory()) { if (path !== 'design-contract/link-tv') inspect(file); } else if (entry.name !== 'lock.json' && !lock.files[path]) throw new Error(`Unpinned design artifact: ${path}`); } };
  for (const dir of [destination, avatars]) if (existsSync(dir)) inspect(dir);
  console.log(`Design token integrity passed: ${lock.revision}`);
} else throw new Error('Use sync <design-checkout> [revision] or check');
