import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Feedback, Field } from './shared';
import { ApiError, type Client } from './lib/api';
import { useProtectedPresentation } from './ProtectedPresentation';
import { AddonReview, ItemReview, selectedCounts, rowCountKeys, type Counts, type ReviewItem, type AddonItem } from './StremioReview';

type Session = { preview_id: string; profile_id: string | number; expires_at: number };
type AddonPreview = Session & { stage: 'addons'; addons: AddonItem[] };
type Preview = Session & { stage: 'review'; summary: Counts; review_items: ReviewItem[]; addons_to_add: number; review_revision: number };
type Completion = { profile_id: string | number; summary: Counts; already_completed?: boolean; addons_added?: number; excluded_items?: number };
const previewLabels: [string, string][] = [
  ['source_items', 'Source library records'], ['favorites_to_add', 'My List additions'],
  ['progress_to_add', 'New history/resume entries'], ['progress_to_update', 'Older history to update'],
  ['existing_preserved', 'Existing entries preserved'], ['already_imported', 'Already imported'],
  ['needs_review', 'Needs review — not imported'], ['skipped_items', 'Skipped source entries'],
];
const completionLabels: [string, string][] = [
  ['favorites_added', 'My List additions'], ['progress_added', 'New history/resume entries'],
  ['progress_updated', 'History entries updated'], ['existing_preserved', 'Existing entries preserved'],
  ['already_imported', 'Already imported'], ['needs_review', 'Needs review — not imported'], ['skipped_items', 'Skipped source entries'],
];
const token = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(value);
const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 100_000;
const name = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 512 && !/[\u0000-\u001f\u007f]/.test(value) && !value.includes('://');
function validCounts(value: unknown, fields: [string, string][]): value is Counts {
  return !!value && typeof value === 'object' && fields.every(([key]) => count((value as Counts)[key]));
}
function validSession(value: Session, profile: string): boolean {
  return !!value && String(value.profile_id) === profile && token(value.preview_id) && Number.isSafeInteger(value.expires_at) && value.expires_at * 1000 > Date.now();
}
function validReview(value: Preview, profile: string): boolean {
  if (!validSession(value, profile) || value.stage !== 'review' || !count(value.addons_to_add) || !Number.isSafeInteger(value.review_revision) || value.review_revision <= 0 || !validCounts(value.summary, previewLabels) || !Array.isArray(value.review_items) || value.review_items.length > 20_000) return false;
  const ids = new Set<string>();
  const valid = value.review_items.every(item => {
    if (!item || !token(item.item_id) || ids.has(item.item_id) || !name(item.name) || !['movie', 'series'].includes(item.type) || !['ready', 'preserved', 'needs_review'].includes(item.status) || typeof item.selectable !== 'boolean') return false;
    ids.add(item.item_id);
    if (![item.favorite_action, item.progress_action].every(action => ['add', 'update', 'preserve', 'already_imported', 'none'].includes(action)) || !validCounts(item.counts, rowCountKeys.map(key => [key, key]))) return false;
    if (![item.season, item.episode].every(value => value == null || count(value)) || ![item.position, item.duration].every(value => value == null || (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1_000_000))) return false;
    return [item.watched, item.watch_date_known].every(value => value == null || typeof value === 'boolean');
  });
  return valid && rowCountKeys.every(key => value.review_items.reduce((total, item) => total + item.counts[key], 0) === value.summary[key]);
}
function validAddons(value: AddonPreview, profile: string): boolean {
  if (!validSession(value, profile) || value.stage !== 'addons' || !Array.isArray(value.addons) || value.addons.length > 100) return false;
  const ids = new Set<string>();
  return value.addons.every(item => {
    if (!item || !token(item.item_id) || ids.has(item.item_id) || !name(item.name) || !['add', 'existing', 'unavailable'].includes(item.status) || !Array.isArray(item.resources) || item.resources.length > 4 || !item.resources.every(resource => ['catalog', 'meta', 'stream', 'subtitles'].includes(resource))) return false;
    ids.add(item.item_id); return true;
  });
}
function safeError(error: unknown, applying: boolean): string {
  if (error instanceof ApiError) {
    if (error.errorCode === 'stremio_credentials_invalid') return 'Stremio sign-in failed. Check your details.';
    if (['stremio_preview_stale', 'stremio_preview_expired', 'stremio_preview_not_found', 'stremio_selection_mismatch'].includes(error.errorCode ?? '')) return 'This preview is no longer current. Preview again.';
    if (error.errorCode === 'stremio_restricted_profile') return 'Switch to an unrestricted profile to import.';
    if (error.errorCode === 'stremio_source_unavailable') return 'Could not read Stremio. Try again.';
    if (error.errorCode === 'stremio_addon_unavailable') return 'An add-on could not be verified. Change your add-on choices and try again.';
    if (error.errorCode === 'stremio_import_busy') return 'Too many imports are pending. Cancel a preview or try again shortly.';
    if (error.errorCode === 'stremio_storage_unavailable') return 'Import storage is temporarily unavailable. Try again.';
    if (error.errorCode === 'stremio_invalid_request') return 'This import request could not be accepted. Start a new preview and try again.';
    if (error.errorCode === 'secret_store_not_configured') return 'The server needs encrypted add-on storage before importing configuration.';
  }
  if (error instanceof Error && ['Invalid review', 'Invalid add-ons', 'Replaced review'].includes(error.message)) return 'The server returned an unexpected import review. Start a new preview or update VIPTV.';
  return applying ? 'Could not confirm the import. Retry this preview; completed items will not be duplicated.' : 'Could not prepare the import. Check your details or add-on choices and try again.';
}
function Summary({ counts, labels }: { counts: Counts; labels: [string, string][] }) {
  return <dl className="grid gap-3 text-sm">{labels.map(([key, label]) => <div className="flex min-w-0 items-start justify-between gap-4" key={key}><dt className="min-w-0 break-words">{label}</dt><dd className="shrink-0 font-semibold tabular-nums">{counts[key]}</dd></div>)}</dl>;
}

/** All credentials, handles and selection drafts are ephemeral and session-scoped. */
export function StremioImport({ api, profile, profileName, restricted = false, onManageAddons }: { api: Client; profile: string; profileName: string; restricted?: boolean; onManageAddons?: () => void }) {
  const blocked = useProtectedPresentation();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [library, setLibrary] = useState(true); const [progress, setProgress] = useState(true);
  const [stage, setStage] = useState<'connect' | 'addons' | 'items' | 'confirm' | 'complete'>('connect');
  const [addons, setAddons] = useState<AddonPreview>(); const [selectedAddons, setSelectedAddons] = useState(new Set<string>());
  const [failedAddons, setFailedAddons] = useState(new Set<string>());
  const [preview, setPreview] = useState<Preview>(); const [excluded, setExcluded] = useState(new Set<string>());
  const [reviewedAddons, setReviewedAddons] = useState<string>();
  const [completion, setCompletion] = useState<Completion>(); const [confirmed, setConfirmed] = useState(false); const [selectionLocked, setSelectionLocked] = useState(false);
  const [expired, setExpired] = useState(false); const [busy, setBusy] = useState<'preview' | 'review' | 'apply'>(); const [error, setError] = useState('');
  const epoch = useRef(0); const pending = useRef<AbortController | undefined>(undefined); const handle = useRef<string | undefined>(undefined);
  const emailInput = useRef<HTMLInputElement>(null); const heading = useRef<HTMLHeadingElement>(null);
  const path = `/profiles/${encodeURIComponent(profile)}/imports/stremio`;

  useEffect(() => {
    setEmail(''); setPassword(''); setAddons(undefined); setPreview(undefined); setCompletion(undefined); setSelectedAddons(new Set()); setExcluded(new Set());
    setConfirmed(false); setSelectionLocked(false); setExpired(false); setBusy(undefined); setError(''); setReviewedAddons(undefined); setFailedAddons(new Set()); setStage('connect');
    return () => {
      epoch.current++; pending.current?.abort(); pending.current = undefined;
      const old = handle.current; handle.current = undefined;
      if (old) void api(`${path}/${encodeURIComponent(old)}`, 'DELETE').catch(() => {});
    };
  }, [api, path, blocked, restricted]);
  const active = completion ? undefined : preview ?? addons;
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => {
      reset(); setExpired(true);
      setError(selectionLocked ? 'This preview expired. Some changes may already have been saved. Start a new preview to review the current account state.' : 'This preview is no longer current. Preview again.');
    }, Math.max(0, active.expires_at * 1000 - Date.now()));
    return () => clearTimeout(timer);
  }, [active, selectionLocked]);
  useEffect(() => { if (stage !== 'connect' || addons || preview) heading.current?.focus(); }, [stage, addons, preview]);

  function reset() {
    epoch.current++; pending.current?.abort(); pending.current = undefined;
    const old = handle.current; handle.current = undefined;
    if (old) void api(`${path}/${encodeURIComponent(old)}`, 'DELETE').catch(() => {});
    setEmail(''); setPassword(''); setAddons(undefined); setPreview(undefined); setCompletion(undefined); setSelectedAddons(new Set()); setExcluded(new Set());
    setConfirmed(false); setSelectionLocked(false); setExpired(false); setBusy(undefined); setError(''); setReviewedAddons(undefined); setFailedAddons(new Set()); setStage('connect');
    queueMicrotask(() => emailInput.current?.focus());
  }
  function acceptReview(value: Preview, chosen?: string) {
    if (!validReview(value, profile)) throw new Error('Invalid review');
    handle.current = value.preview_id; setPreview(value);
    setExcluded(previous => new Set(value.review_items.filter(item => item.selectable && previous.has(item.item_id)).map(item => item.item_id)));
    setReviewedAddons(chosen); setConfirmed(false); setExpired(false); setSelectionLocked(false); setStage('items');
  }
  async function loadPreview(event: FormEvent) {
    event.preventDefault();
    if (pending.current || blocked || restricted || !profile || !email.trim() || !password) return;
    const request = ++epoch.current; const controller = new AbortController(); pending.current = controller;
    const body = { email: email.trim(), password, import_library: library, import_progress: progress, inspect_addons: true };
    setPassword(''); setError(''); setBusy('preview');
    try {
      const value = await api<Preview | AddonPreview>(`${path}/preview`, 'POST', body, controller.signal);
      if (request !== epoch.current || controller.signal.aborted) return;
      if (value?.stage === 'addons') {
        if (!validAddons(value, profile)) throw new Error('Invalid add-ons');
        handle.current = value.preview_id; setAddons(value); setSelectedAddons(new Set(value.addons.filter(item => item.status !== 'unavailable').map(item => item.item_id))); setExpired(false); setStage('addons');
      } else acceptReview(value as Preview);
    } catch (failure) {
      if (request === epoch.current && !controller.signal.aborted) setError(safeError(failure, false));
    } finally { body.password = ''; if (request === epoch.current) { pending.current = undefined; setBusy(undefined); } }
  }
  async function verifyMetadata(chosen = selectedAddons) {
    if (!addons || expired || pending.current || blocked || restricted || addons.expires_at * 1000 <= Date.now()) return;
    const key = [...chosen].sort().join(',');
    if (preview && reviewedAddons === key) { setError(''); setStage('items'); return; }
    const request = ++epoch.current; const controller = new AbortController(); pending.current = controller;
    setReviewedAddons(undefined);
    setError(''); setFailedAddons(new Set()); setBusy('review');
    try {
      const value = await api<Preview>(`${path}/${encodeURIComponent(addons.preview_id)}/review`, 'POST', { selected_addons: [...chosen].sort(), expected_review_revision: preview?.review_revision ?? 0 }, controller.signal);
      if (request !== epoch.current || controller.signal.aborted) return;
      if (value.preview_id !== addons.preview_id || (preview && value.review_revision <= preview.review_revision)) throw new Error('Replaced review');
      acceptReview(value, key);
    } catch (failure) {
      if (request === epoch.current && !controller.signal.aborted) {
        setReviewedAddons(undefined); setConfirmed(false);
        if (failure instanceof ApiError && failure.errorCode === 'stremio_addon_unavailable') setFailedAddons(new Set(addons.addons.filter(item => failure.failedAddonItems.includes(item.item_id)).map(item => item.item_id)));
        if (failure instanceof ApiError && ['stremio_preview_stale', 'stremio_preview_expired', 'stremio_preview_not_found', 'stremio_selection_mismatch'].includes(failure.errorCode ?? '')) { reset(); setExpired(true); }
        setError(safeError(failure, false));
      }
    } finally { if (request === epoch.current) { pending.current = undefined; setBusy(undefined); } }
  }
  const included = preview?.review_items.filter(item => item.selectable && !excluded.has(item.item_id)).length ?? 0;
  const chosenCounts = preview ? selectedCounts(preview.summary, preview.review_items, excluded) : undefined;
  const hasScope = !!preview && (preview.addons_to_add > 0 || !!chosenCounts && ['favorites_to_add', 'progress_to_add', 'progress_to_update'].some(key => chosenCounts[key] > 0));
  async function apply() {
    if (!preview || !confirmed || !hasScope || expired || preview.expires_at * 1000 <= Date.now() || pending.current || blocked || restricted) return;
    const request = ++epoch.current; const controller = new AbortController(); pending.current = controller;
    setBusy('apply'); setSelectionLocked(true); setError('');
    try {
      const value = await api<Completion>(`${path}/${encodeURIComponent(preview.preview_id)}/apply`, 'POST', { confirm: true, excluded_items: [...excluded].sort(), review_revision: preview.review_revision }, controller.signal);
      if (request !== epoch.current || controller.signal.aborted) return;
      if (String(value?.profile_id) !== profile || !validCounts(value?.summary, completionLabels) || (value.addons_added != null && !count(value.addons_added)) || (value.excluded_items != null && !count(value.excluded_items))) throw new Error('Invalid completion');
      setCompletion(value); setPreview(undefined); setConfirmed(false); setStage('complete');
    } catch (failure) {
      if (request === epoch.current && !controller.signal.aborted) {
        setError(safeError(failure, true));
        if (failure instanceof ApiError && ['stremio_preview_stale', 'stremio_preview_expired', 'stremio_preview_not_found', 'stremio_selection_mismatch'].includes(failure.errorCode ?? '')) { setSelectionLocked(false); reset(); setExpired(true); setError('This preview is no longer current. Preview again.'); }
      }
    } finally { if (request === epoch.current) { pending.current = undefined; setBusy(undefined); } }
  }
  const confirmation = `I confirm this import is for ${profileName}.`;

  return <Card><CardHeader><CardTitle>Import from Stremio</CardTitle></CardHeader><CardContent className="space-y-5">
    <p className="break-words text-sm [overflow-wrap:anywhere]">Import into: <strong>{profileName}</strong></p>
    <p className="text-sm text-muted-foreground">Review add-ons, verify metadata, then choose exactly which items to import. Nothing is saved until final confirmation.</p>
    <Feedback error={error}/>
    {restricted || !profile ? <p role="status">Switch to an unrestricted profile to import.</p> : <>
    {!completion && <p className="text-sm text-muted-foreground" aria-label="Import progress">Step {stage === 'connect' ? 1 : stage === 'addons' ? 2 : stage === 'items' ? 3 : 4} of 4: {stage === 'connect' ? 'Connect Stremio' : stage === 'addons' ? 'Choose add-ons' : stage === 'items' ? 'Review items' : 'Confirm import'}</p>}
    {completion ? <section className="space-y-4">
      <h3 ref={heading} tabIndex={-1} className="font-semibold">Import complete</h3>
      <p role="status">{completion.already_completed ? 'This import was already completed.' : 'The confirmed changes were saved to this profile.'}</p>
      <Summary counts={completion.summary} labels={completionLabels}/>
      {completion.addons_added != null && <p className="text-sm">Add-ons added to your account: {completion.addons_added}</p>}{completion.excluded_items != null && <p className="text-sm">Review items excluded: {completion.excluded_items}</p>}
      <Button variant="outline" onClick={reset}>Start another preview</Button>
    </section> : stage === 'addons' && addons ? <section className="space-y-4" aria-busy={busy === 'review'}>
      <h3 ref={heading} tabIndex={-1} className="font-semibold">Choose add-ons</h3>
      <p className="text-sm">Do you want to bring these add-ons into VIPTV? Uncheck any you do not want.</p>
      <AddonReview items={addons.addons} selected={selectedAddons} failed={failedAddons} onChange={value => { setSelectedAddons(value); setConfirmed(false); }} disabled={!!busy || expired}/>
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!!busy || expired} onClick={() => setSelectedAddons(new Set(addons.addons.filter(item => item.status !== 'unavailable').map(item => item.item_id)))}>Select all</Button><Button variant="outline" disabled={!!busy || expired} onClick={() => setSelectedAddons(new Set())}>Clear all</Button></div>
      {busy && <p role="status">Verifying metadata and preparing named items…</p>}
      <div className="flex flex-wrap gap-3"><Button variant="outline" disabled={!!busy || selectionLocked} onClick={() => { setConfirmed(false); setStage('connect'); }}>Back</Button><Button variant="outline" disabled={!!busy || expired} onClick={() => { setSelectedAddons(new Set()); void verifyMetadata(new Set()); }}>Continue without add-ons</Button><Button disabled={!!busy || expired} onClick={() => void verifyMetadata()}>Next: Review items</Button></div>
    </section> : stage === 'items' && preview ? <section className="space-y-4" aria-busy={busy === 'review'}>
      <h3 ref={heading} tabIndex={-1} className="font-semibold">Review items</h3>
      <Summary counts={selectedCounts(preview.summary, preview.review_items, excluded)} labels={previewLabels}/>
      <p className="text-sm">New add-ons to register for your account: <strong>{preview.addons_to_add}</strong></p>
      <ItemReview items={preview.review_items} excluded={excluded} onChange={value => { setExcluded(value); setConfirmed(false); }} disabled={!!busy || expired || selectionLocked}/>
      <p className="text-sm text-muted-foreground">Newer or equal VIPTV history and manual corrections are preserved. Unknown episode watch dates are not invented. Likes/loves are not imported.</p>
      <div className="flex flex-wrap gap-3"><Button variant="outline" disabled={!!busy || selectionLocked} onClick={() => { setConfirmed(false); setStage(addons ? 'addons' : 'connect'); }}>Back</Button><Button variant="outline" disabled={!!busy} onClick={reset}>{expired ? 'Preview again' : 'Cancel'}</Button><Button disabled={!!busy || expired || !hasScope} onClick={() => { setConfirmed(false); setStage('confirm'); }}>Next: Confirm import</Button></div>
    </section> : stage === 'confirm' && preview ? <section className="space-y-4" aria-busy={busy === 'apply'}>
      <h3 ref={heading} tabIndex={-1} className="font-semibold">Confirm import</h3>
      <p className="break-words text-sm">Review your chosen import into <strong>{profileName}</strong>.</p>
      <Summary counts={selectedCounts(preview.summary, preview.review_items, excluded)} labels={previewLabels}/>
      <p className="text-sm">Selected review items: <strong>{included}</strong>. New account-wide add-ons: <strong>{preview.addons_to_add}</strong>.</p>
      {selectedAddons.size > 0 && <div className="text-sm"><p>Chosen add-ons:</p><ul className="list-inside list-disc">{addons?.addons.filter(item => selectedAddons.has(item.item_id)).map(item => <li className="break-words [overflow-wrap:anywhere]" key={item.item_id}>{item.name}{item.status === 'existing' ? ' (already configured)' : ''}</li>)}</ul></div>}
      {preview.addons_to_add > 0 && <p className="text-sm">Selected new add-ons are added to your account only when you confirm.</p>}
      {selectionLocked && <p className="text-sm text-muted-foreground">This selection is locked while its result is being confirmed. Retrying uses the same items.</p>}
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={confirmed} disabled={!!busy || expired || !hasScope} onChange={event => setConfirmed(event.target.checked)} className="mt-1 shrink-0"/><span className="min-w-0 break-words [overflow-wrap:anywhere]">{confirmation}</span></label>
      {busy && <p role="status">Saving the confirmed import…</p>}
      <div className="flex flex-wrap gap-3"><Button variant="outline" disabled={!!busy || selectionLocked} onClick={() => { setConfirmed(false); setStage('items'); }}>Back</Button><Button variant="outline" disabled={!!busy || selectionLocked} onClick={reset}>{expired ? 'Preview again' : 'Cancel'}</Button><Button disabled={!confirmed || !hasScope || expired || !!busy} onClick={() => void apply()}>Confirm import</Button></div>
    </section> : stage === 'connect' && (addons || preview) ? <section className="space-y-4">
      <h3 ref={heading} tabIndex={-1} className="font-semibold">Connect Stremio</h3>
      <p className="text-sm">Stremio is connected for this preview. Your add-on and item choices are still saved in this draft.</p>
      <dl className="grid gap-2 text-sm"><div className="min-w-0"><dt className="font-medium">Stremio email</dt><dd className="break-words [overflow-wrap:anywhere]">{email}</dd></div><div><dt className="font-medium">Source choices</dt><dd>{library ? 'My List' : ''}{library && progress ? ' · ' : ''}{progress ? 'Watch history and resume' : ''}{!library && !progress ? 'Add-ons only' : ''}</dd></div></dl>
      <p className="text-sm text-muted-foreground">Your password was cleared after connecting. Changing the connection starts a new preview.</p>
      <div className="flex flex-wrap gap-3"><Button disabled={expired} onClick={() => setStage(addons ? 'addons' : 'items')}>Next: {addons ? 'Choose add-ons' : 'Review items'}</Button><Button variant="outline" onClick={reset}>Change connection</Button></div>
    </section> : <form onSubmit={event => void loadPreview(event)} className="space-y-4" aria-busy={busy === 'preview'}>
      <h3 ref={heading} tabIndex={-1} className="font-semibold">Connect Stremio</h3>
      <fieldset className="grid min-w-0 gap-4" disabled={!!busy || blocked}>
        <label className="grid min-w-0 gap-2 text-sm font-medium"><span>Stremio email</span><Input ref={emailInput} type="email" autoComplete="off" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)}/></label>
        <Field label="Stremio password" type="password" autoComplete="off" required maxLength={1024} value={password} onChange={event => setPassword(event.target.value)}/>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={library} onChange={event => setLibrary(event.target.checked)} className="mt-1 shrink-0"/><span>My List</span></label>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={progress} onChange={event => setProgress(event.target.checked)} className="mt-1 shrink-0"/><span>Watch history and resume</span></label>
      </fieldset>
      {busy && <p role="status">Reading Stremio for a read-only preview…</p>}
      <div className="flex flex-wrap gap-3"><Button type="submit" disabled={!!busy || blocked}>Next: Choose add-ons</Button>{busy && <Button type="button" variant="outline" onClick={reset}>Cancel</Button>}{onManageAddons && !busy && <Button type="button" variant="outline" onClick={onManageAddons}>Manage existing add-ons</Button>}</div>
      <p className="text-sm text-muted-foreground">Compatible metadata add-ons help verify titles and episodes; they cannot recover watch dates Stremio did not record. Your password is used for this request only and is not saved by VIPTV.</p>
    </form>}</>}
  </CardContent></Card>;
}
