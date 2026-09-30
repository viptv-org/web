import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const path = resolve(root, 'MIGRATION.json');
const inventory = JSON.parse(readFileSync(path, 'utf8'));
const retired = new Set(['Admin.tsx', 'FamilyLineup.tsx', 'FamilyLineup.test.tsx', 'FamilyMatching.tsx', 'FamilyMatching.test.tsx',
  'FamilyHealth.tsx', 'FamilyGuides.tsx', 'FamilyActivity.tsx', 'FamilyMaintenance.test.tsx', 'CatalogAutomation.tsx', 'CatalogAutomation.test.tsx',
  'AccountPools.tsx', 'AccountPools.test.tsx', 'ProviderAccounts.tsx', 'ProviderAccounts.test.tsx', 'ProviderSettings.tsx', 'Providers.test.tsx',
  'AddonSettings.tsx', 'Addons.test.tsx', 'LiveCategories.tsx', 'LiveCategories.test.tsx', 'ServiceHealth.tsx', 'ServiceHealth.test.tsx']);
for (const entry of inventory.files) {
  if (!entry.destination || entry.destination.startsWith('/') || entry.destination.split('/').includes('..')) throw Error('Unsafe inventory path');
  const file = resolve(root, entry.destination);
  if (!existsSync(file)) {
    if (!entry.removed && !(entry.destination.startsWith('src/') && retired.has(entry.destination.slice(4)))) throw Error(`Unexpected missing source: ${entry.destination}`);
    entry.removed = true;
    entry.reason = 'ADM-002 retires the legacy organizer/setup UI and its obsolete tests; original extraction checksum remains historical provenance.';
    continue;
  }
  const hash = createHash('sha256').update(readFileSync(file)).digest('hex');
  if (hash !== (entry.extracted_sha256 ?? entry.sha256)) {
    entry.extracted_sha256 = hash;
    entry.reason = `${entry.reason ?? ''} ADM-002 account-owned v2 management and approved design adoption; original extraction checksum retained.`.trim();
  }
}
writeFileSync(path, JSON.stringify(inventory, null, 2) + '\n');
