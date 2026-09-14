from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parents[1]
m=json.loads((root/'MIGRATION.json').read_text())
packaged=set(m.get('packaging_changes',[]))
repinned=0
for entry in m['files']:
    p=root/entry['destination']
    if entry.get('removed'):
        assert not p.exists(), f'Recorded removal no longer holds: {p}'
        continue
    actual=hashlib.sha256(p.read_bytes()).hexdigest()
    assert actual==entry.get('extracted_sha256',entry['sha256']), f'Migration mismatch: {p}'
    if actual!=entry['sha256']:
        assert entry.get('reason') or entry['destination'] in packaged, f'Re-pinned entry needs a reason: {p}'
        repinned+=1
print('Migration checksums verified:',len(m['files']),'files')
print('Re-pinned against the extraction revision:',repinned,'entries')