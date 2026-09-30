import { useEffect, useRef, useState } from 'react';
import { Network } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Empty, Feedback, Field, Modal, Submit } from './shared';
import { useAction } from './hooks';
import { useCursorResource } from './useCursorResource';
import { encode, type Client } from './lib/api';
import { CursorEnd } from './CursorEnd';

type Gateway = { id: string; name: string; endpoint: string; namespace: string; priority: number; enabled: boolean; revision: number; can_manage: boolean };
type Capacity = { inputs: number; outputs: number; viewers: number };
type Check = { ready: boolean; version: number; available: Capacity | null };
type Grant = { account_id: number; enabled: boolean };
type GrantDraft = { account: string; confirm?: Grant };
const badResponse = () => new Error('The server returned invalid gateway settings. Try again or update the server.');
function gateway(value: unknown): Gateway {
  const row = value as Gateway;
  if (!row || typeof row.id !== 'string' || typeof row.name !== 'string' || typeof row.endpoint !== 'string' || typeof row.namespace !== 'string' ||
    !Number.isInteger(row.priority) || !Number.isInteger(row.revision) || typeof row.enabled !== 'boolean' || typeof row.can_manage !== 'boolean') throw badResponse();
  return { id: row.id, name: row.name, endpoint: row.endpoint, namespace: row.namespace, priority: row.priority, revision: row.revision, enabled: row.enabled, can_manage: row.can_manage };
}
function capacity(value: unknown): Check {
  const result = value as Check;
  if (!result || typeof result.ready !== 'boolean' || result.version !== 1 ||
      result.available != null && ['inputs', 'outputs', 'viewers'].some(key => !Number.isInteger(result.available![key as keyof Capacity]) || result.available![key as keyof Capacity] < 0)) throw badResponse();
  return { ready: result.ready, version: result.version, available: result.available ?? null };
}
function Grants({ api, row, busy, mutate, draft, changeDraft }: { api: Client; row: Gateway; busy: boolean; mutate: (work: () => Promise<void>, message: string) => void; draft: GrantDraft; changeDraft: (draft: GrantDraft) => void }) {
  const grants = useCursorResource<Grant>(api, `/v2/gateways/${encode(row.id)}/grants?limit=50`);
  const {account,confirm}=draft;
  const setAccount=(account:string)=>changeDraft({...draft,account});const setConfirm=(confirm?:Grant)=>changeDraft({...draft,confirm});
  const recipients = grants.items.map(item => ({...item, account_id: Number(item?.account_id)}));
  const valid = grants.items.every(item => item && /^[1-9][0-9]*$/.test(String(item.account_id)) && Number.isSafeInteger(Number(item.account_id)) && item.enabled === true);
  return <div className="space-y-4"><p>Grants allow playback and capacity checks. Connection settings remain private.</p>
    {!valid && <><Feedback error="The server returned invalid grant recipients. Try again."/><Button variant="outline" onClick={grants.reload}>Retry recipients</Button></>}<Feedback error={grants.error}/>{grants.loading && <p role="status">Loading recipients…</p>}{grants.error && <Button variant="outline" onClick={grants.reload}>Try again</Button>}
    {valid && recipients.map(item => <div className="admin-state-row" key={item.account_id}><span className="admin-row-main">Account {item.account_id} · Access enabled</span><Button variant="outline" disabled={busy} onClick={() => setConfirm({ account_id: item.account_id, enabled: false })} aria-label={`Revoke account ${item.account_id}`}>Revoke</Button></div>)}
    {valid && !grants.loading && !grants.error && !grants.items.length && <p>No gateway grants.</p>}<CursorEnd onLoad={grants.more} disabled={!valid || !grants.next || grants.loading || !!grants.error} generation={grants.items.length}/>
    <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); const id = Number(account); if (Number.isSafeInteger(id) && id > 0) setConfirm({ account_id: id, enabled: true }); }}><Field label="Account ID" type="number" min="1" step="1" required value={account} disabled={busy} onChange={event => setAccount(event.target.value)}/><Button type="submit" variant="outline" disabled={busy}>Grant access</Button></form>
    {confirm && <section className="grid gap-3 rounded-md border p-4" aria-label="Confirm gateway access change"><p>{confirm.enabled ? `Allow account ${confirm.account_id} to use ${row.name}?` : `Revoke account ${confirm.account_id}? Its active gateway playback becomes unavailable.`}</p><div className="flex flex-wrap gap-3"><Button disabled={busy} onClick={() => mutate(async () => {
      await api(`/v2/gateways/${encode(row.id)}/grants`, 'PUT', confirm);
      if (!confirm.enabled) grants.setItems(items => items.filter(item => Number(item.account_id) !== confirm.account_id));
      else grants.reload();
      changeDraft({account:''});
    }, confirm.enabled ? 'Gateway access granted.' : 'Gateway access revoked.')}>{confirm.enabled ? 'Confirm grant' : 'Confirm revoke'}</Button><Button variant="outline" disabled={busy} onClick={() => setConfirm(undefined)}>Cancel access change</Button></div></section>}
  </div>;
}

export function V2Gateways({ api, operator = false, grantsOnly = false }: { api: Client; operator?: boolean; grantsOnly?: boolean }) {
  const [rows, setRows] = useState<Gateway[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [version, setVersion] = useState(0);
  const [checks, setChecks] = useState<Record<string, Check>>({}); const [configured, setConfigured] = useState<boolean | undefined>();
  const action = useAction(); const pending = useRef(false);
  const [mode, setMode] = useState<'create' | 'replace' | 'delete' | 'grants'>(); const [selected, setSelected] = useState<Gateway>();
  const blank = { name: '', endpoint: '', namespace: '', priority: '100', integration_key: '' };
  const [draft, setDraft] = useState(blank);
  const [grantDraft,setGrantDraft]=useState<GrantDraft>({account:''});
  useEffect(() => {
    if (grantsOnly && !operator) return;
    const abort = new AbortController(); setLoading(true); setError('');
    void api<{items: unknown[]; secret_storage_configured: boolean}>('/v2/gateways', 'GET', undefined, abort.signal).then(value => {
      if (!value || !Array.isArray(value.items) || value.items.length > 64 || typeof value.secret_storage_configured !== 'boolean') throw badResponse();
      const items = value.items.map(gateway);
      if (!abort.signal.aborted) { setRows(items); setConfigured(value.secret_storage_configured); }
    }).catch(failure => { if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : 'Could not load gateways.'); }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [api, grantsOnly, operator, version]);
  function run(work: () => Promise<void>, message: string) {
    if (pending.current) return; pending.current = true;
    void action.run(async () => { try { await work(); } finally { pending.current = false; } }, message);
  }
  function open(next: typeof mode, row?: Gateway) {
    action.clear(); setSelected(row); setMode(next);
    setGrantDraft({account:''});
    setDraft(next === 'replace' && row ? { ...blank, name: row.name, endpoint: row.endpoint, namespace: row.namespace, priority: String(row.priority) } : blank);
  }
  function close() { setMode(undefined); setDraft(blank);setGrantDraft({account:''}); }
  function check(row: Gateway) {
    run(async () => { const result = capacity(await api(`/v2/gateways/${encode(row.id)}/check`, 'POST')); setChecks(previous => ({ ...previous, [row.id]: result })); }, 'Gateway checked.');
  }
  if (grantsOnly && !operator) return <Feedback error="Operator access is required to manage gateway grants."/>;
  const visible = rows.filter(row => !grantsOnly || row.can_manage);
  return <div className="space-y-4"><div className="admin-toolbar"><p>{grantsOnly ? 'Grant access to your gateways and check available capacity.' : 'Your private playback gateways and authorized shared connections.'}</p>{!grantsOnly && <Button disabled={action.busy || configured === false} onClick={() => open('create')}>Add gateway</Button>}<Button variant="outline" disabled={loading} onClick={() => setVersion(value => value + 1)}>Refresh list</Button></div>
    <Feedback error={error}/><Feedback error={action.error} success={action.success}/>{configured === false && <p>Gateway configuration is unavailable until the operator configures secure storage.</p>}{loading && <p role="status">Loading gateways…</p>}{error && <Button variant="outline" onClick={() => setVersion(value => value + 1)}>Try again</Button>}
    {visible.map(row => <Card key={row.id} className="admin-state-row"><Network className="admin-row-icon" aria-hidden="true"/><div className="admin-row-main"><div><h3>{row.name}</h3><p className="admin-status">{row.enabled ? 'Enabled' : 'Disabled'} · {row.can_manage ? 'Your gateway' : 'Granted access'}</p><p className="break-words">{row.endpoint}</p><p>Namespace: {row.namespace} · Priority: {row.priority}</p><p>{checks[row.id] ? checks[row.id].ready ? 'Last check: ready' : 'Last check: not ready' : 'Not checked this visit'}</p>{checks[row.id]?.available ? <p>Available inputs: {checks[row.id].available!.inputs} · Outputs: {checks[row.id].available!.outputs} · Viewers: {checks[row.id].available!.viewers}</p> : <p>Capacity unknown{checks[row.id] && ' — the gateway did not report capacity hints'}.</p>}</div></div>
      <div className="admin-row-actions"><Button variant="outline" disabled={action.busy || !row.enabled} aria-label={`Check ${row.name}`} onClick={() => check(row)}>Check capacity</Button>{row.can_manage && !grantsOnly && <><Button variant="outline" disabled={action.busy} aria-label={`Replace key for ${row.name}`} onClick={() => open('replace', row)}>Replace connection</Button><Button variant="outline" role="switch" aria-checked={row.enabled} aria-label={`Enable ${row.name}`} disabled={action.busy} onClick={() => run(async () => {
        await api(`/v2/gateways/${encode(row.id)}`, 'PATCH', { enabled: !row.enabled }); setRows(items => items.map(item => item.id === row.id ? { ...item, enabled: !row.enabled } : item));
        setChecks(previous => { const next = { ...previous }; delete next[row.id]; return next; });
      }, 'Gateway updated.')}>{row.enabled ? 'Disable' : 'Enable'}</Button><Button variant="outline" disabled={action.busy} aria-label={`Delete ${row.name}`} onClick={() => open('delete', row)}>Delete</Button></>}{operator && row.can_manage && <Button variant="outline" disabled={action.busy} aria-label={`Manage grants for ${row.name}`} onClick={() => open('grants', row)}>Manage grants</Button>}</div></Card>)}
    {!loading && !error && !visible.length && <Empty title={grantsOnly ? 'No owned gateways' : 'No gateways'}>{grantsOnly ? 'Register a gateway in your account before granting access.' : 'Add a private gateway or ask its owner to grant your account access.'}</Empty>}
    <Modal open={!!mode} onOpenChange={value => { if (!value) close(); }} title={mode === 'create' ? 'Add gateway' : mode === 'replace' ? 'Replace gateway connection' : mode === 'grants' ? 'Gateway grants' : 'Delete gateway'} description={mode === 'delete' ? `Remove ${selected?.name}? Its grants and active gateway playback become unavailable. History is retained.` : mode === 'grants' ? selected?.name ?? '' : 'Supply the gateway address and a new scoped integration key. Stored keys are never displayed.'}>
      {mode === 'grants' && selected ? <><Grants key={selected.id} api={api} row={selected} busy={action.busy} mutate={run} draft={grantDraft} changeDraft={setGrantDraft}/><Feedback error={action.error} success={action.success}/><Button variant="outline" onClick={close}>Close</Button></> : <form className="grid gap-4" onSubmit={event => { event.preventDefault(); run(async () => {
        if (mode === 'delete') { await api(`/v2/gateways/${encode(selected!.id)}`, 'DELETE'); setRows(items => items.filter(item => item.id !== selected!.id)); }
        else {
          const updated = gateway(await api(mode === 'replace' ? `/v2/gateways/${encode(selected!.id)}` : '/v2/gateways', mode === 'replace' ? 'PUT' : 'POST', { ...draft, priority: Number(draft.priority) }));
          setRows(items => selected ? items.map(item => item.id === updated.id ? updated : item) : [updated, ...items]);
          setChecks(previous => { const next = { ...previous }; delete next[updated.id]; return next; });
        }
        close();
      }, mode === 'delete' ? 'Gateway removed.' : 'Gateway saved.'); }}><fieldset disabled={action.busy} className="grid min-w-0 gap-4">{mode !== 'delete' && <><Field label="Gateway name" maxLength={128} required value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })}/><Field label="HTTPS endpoint" type="url" required value={draft.endpoint} onChange={event => setDraft({ ...draft, endpoint: event.target.value })}/><Field label="Namespace" required maxLength={128} value={draft.namespace} onChange={event => setDraft({ ...draft, namespace: event.target.value })}/><Field label="Priority" type="number" min="0" max="10000" step="1" required value={draft.priority} onChange={event => setDraft({ ...draft, priority: event.target.value })}/><Field label="New integration key" type="password" autoComplete="new-password" required value={draft.integration_key} onChange={event => setDraft({ ...draft, integration_key: event.target.value })}/></>}</fieldset><Feedback error={action.error}/><div className="flex flex-wrap gap-3"><Submit busy={action.busy}>{mode === 'delete' ? 'Delete gateway' : 'Save gateway'}</Submit><Button variant="outline" type="button" onClick={close}>Cancel</Button></div></form>}
    </Modal>
  </div>;
}
