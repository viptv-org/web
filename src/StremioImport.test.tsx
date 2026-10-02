// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StremioImport } from './StremioImport';
import { ProtectedPresentation } from './ProtectedPresentation';
import { ApiError, type Client } from './lib/api';
import { createAccountClient } from './lib/accountApi';

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const root = '/profiles/2/imports/stremio';
const handle = 'synthetic_preview_123456789';
const addon = { item_id: 'synthetic_addon_123456789', name: 'Synthetic metadata', resources: ['meta'], status: 'add' };
const rowCounts = { favorites_to_add: 1, progress_to_add: 0, progress_to_update: 0, existing_preserved: 0, already_imported: 0 };
const movie = { item_id: 'synthetic_movie_123456789', name: 'Saved movie', type: 'movie', favorite_action: 'add', progress_action: 'none', status: 'ready', counts: rowCounts, selectable: true };
const episode = { ...movie, item_id: 'synthetic_episode_123456789', name: 'Episode resume', type: 'series' };
const counts = { source_items: 2, favorites_to_add: 2, progress_to_add: 0, progress_to_update: 0, existing_preserved: 0, already_imported: 0, needs_review: 0, skipped_items: 0 };
const base = () => ({ preview_id: handle, profile_id: 2, expires_at: Math.floor(Date.now() / 1000) + 600 });
const addons = () => ({ ...base(), stage: 'addons', addons: [addon] });
const review = (revision = 1) => ({ ...base(), stage: 'review', summary: counts, review_items: [movie, episode], addons_to_add: 1, review_revision: revision });
const completion = { profile_id: 2, summary: { favorites_added: 2, progress_added: 0, progress_updated: 0, existing_preserved: 0, already_imported: 0, needs_review: 0, skipped_items: 0 } };
function apiFactory() { return vi.fn(async (path: string, method?: string) => method === 'DELETE' ? undefined : path.endsWith('/preview') ? addons() : path.endsWith('/review') ? review() : completion); }
function mount(api: Client) { return render(<StremioImport api={api} profile="2" profileName="Synthetic profile"/>); }
function credentials() { fireEvent.change(screen.getByLabelText('Stremio email'), { target: { value: 'synthetic@example.invalid' } }); fireEvent.change(screen.getByLabelText('Stremio password'), { target: { value: 'synthetic-password' } }); }
async function connect() { credentials(); fireEvent.click(screen.getByRole('button', { name: 'Next: Choose add-ons' })); await screen.findByRole('heading', { name: 'Choose add-ons' }); }
async function items() { fireEvent.click(screen.getByRole('button', { name: 'Next: Review items' })); await screen.findByRole('heading', { name: 'Review items' }); }
function confirmStage() { fireEvent.click(screen.getByRole('button', { name: 'Next: Confirm import' })); expect(screen.getByRole('heading', { name: 'Confirm import' })).toHaveFocus(); }

describe('guided Stremio import', () => {
  it('uses focused stages, selected defaults, a separate unchecked recap, and no early apply', async () => {
    const api = apiFactory(); mount(api as Client); await connect();
    expect(screen.getByRole('heading', { name: 'Choose add-ons' })).toHaveFocus();
    expect(screen.getByLabelText('Import progress')).toHaveTextContent('Step 2 of 4');
    expect(screen.getByLabelText('Use add-on Synthetic metadata')).toBeChecked();
    expect(api).toHaveBeenCalledWith(`${root}/preview`, 'POST', expect.objectContaining({ inspect_addons: true }), expect.any(AbortSignal));
    expect(screen.queryByLabelText('Stremio password')).not.toBeInTheDocument();
    await items();
    expect(screen.getByLabelText('Include Saved movie')).toBeChecked();
    expect(screen.getByLabelText('Include Episode resume')).toBeChecked();
    expect(api).toHaveBeenCalledWith(`${root}/${handle}/review`, 'POST', { selected_addons: [addon.item_id], expected_review_revision: 0 }, expect.any(AbortSignal));
    expect(api.mock.calls.some(call => call[0].endsWith('/apply'))).toBe(false);
    confirmStage();
    expect(screen.getByRole('button', { name: 'Confirm import' })).toBeDisabled();
    fireEvent.click(screen.getByLabelText('I confirm this import is for Synthetic profile.'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm import' }));
    await screen.findByRole('heading', { name: 'Import complete' });
    expect(api).toHaveBeenCalledWith(`${root}/${handle}/apply`, 'POST', { confirm: true, excluded_items: [], review_revision: 1 }, expect.any(AbortSignal));
  });

  it('keeps exact item exclusions through Back and reuses an unchanged review', async () => {
    const api = apiFactory(); mount(api as Client); await connect(); await items();
    fireEvent.click(screen.getByLabelText('Include Saved movie'));
    confirmStage(); fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('Include Saved movie')).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('Use add-on Synthetic metadata')).toBeChecked();
    await items();
    expect(screen.getByLabelText('Include Saved movie')).not.toBeChecked();
    expect(api.mock.calls.filter(call => call[0].endsWith('/review'))).toHaveLength(1);
  });

  it('regenerates changed add-ons and retains stable exclusions', async () => {
    const api = apiFactory(); api.mockImplementation(async (path: string, method?: string) => method === 'DELETE' ? undefined : path.endsWith('/preview') ? addons() : path.endsWith('/review') ? review(api.mock.calls.filter(call => call[0].endsWith('/review')).length) : completion);
    mount(api as Client); await connect(); await items();
    fireEvent.click(screen.getByLabelText('Include Saved movie'));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    await items();
    expect(api).toHaveBeenLastCalledWith(`${root}/${handle}/review`, 'POST', { selected_addons: [], expected_review_revision: 1 }, expect.any(AbortSignal));
    expect(screen.getByLabelText('Include Saved movie')).not.toBeChecked();
    expect(screen.getByLabelText('Include Episode resume')).toBeChecked();
  });

  it('continues without add-ons while retaining the chosen library scope', async () => {
    const api = apiFactory(); mount(api as Client); await connect();
    fireEvent.click(screen.getByRole('button', { name: 'Continue without add-ons' }));
    await screen.findByRole('heading', { name: 'Review items' });
    expect(api).toHaveBeenCalledWith(`${root}/${handle}/review`, 'POST', { selected_addons: [], expected_review_revision: 0 }, expect.any(AbortSignal));
    expect(api.mock.calls.some(call => call[0].endsWith('/apply'))).toBe(false);
  });

  it('allows addon-only scope after turning off library and history', async () => {
    const api = apiFactory(); api.mockImplementation(async (path: string, method?: string) => method === 'DELETE' ? undefined : path.endsWith('/preview') ? addons() : path.endsWith('/review') ? { ...review(), summary: { ...counts, source_items: 0, favorites_to_add: 0 }, review_items: [] } : completion);
    mount(api as Client); fireEvent.click(screen.getByLabelText('My List')); fireEvent.click(screen.getByLabelText('Watch history and resume'));
    await connect(); await items();
    expect(api).toHaveBeenCalledWith(`${root}/preview`, 'POST', expect.objectContaining({ import_library: false, import_progress: false }), expect.any(AbortSignal));
    confirmStage(); expect(screen.getByRole('button', { name: 'Confirm import' })).toBeDisabled();
    fireEvent.click(screen.getByLabelText('I confirm this import is for Synthetic profile.'));
    expect(screen.getByRole('button', { name: 'Confirm import' })).toBeEnabled();
  });

  it('preserves the connection and add-on draft through Back, and discards it on Change connection', async () => {
    const api = apiFactory(); mount(api as Client);
    fireEvent.click(screen.getByLabelText('Watch history and resume'));
    await connect(); fireEvent.click(screen.getByLabelText('Use add-on Synthetic metadata'));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { name: 'Connect Stremio' })).toHaveFocus();
    expect(screen.getByText('synthetic@example.invalid')).toBeInTheDocument();
    expect(screen.getByText('My List')).toBeInTheDocument();
    expect(screen.queryByLabelText('Stremio password')).not.toBeInTheDocument();
    expect(api).not.toHaveBeenCalledWith(`${root}/${handle}`, 'DELETE');
    fireEvent.click(screen.getByRole('button', { name: 'Next: Choose add-ons' }));
    expect(screen.getByLabelText('Use add-on Synthetic metadata')).not.toBeChecked();
    expect(api.mock.calls.filter(call => call[0].endsWith('/preview'))).toHaveLength(1);
    expect(api.mock.calls.filter(call => call[0].endsWith('/review'))).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Change connection' }));
    await waitFor(() => expect(screen.getByLabelText('Stremio email')).toHaveFocus());
    expect(screen.getByLabelText('Stremio email')).toHaveValue('');
    expect(screen.getByLabelText('Stremio password')).toHaveValue('');
    expect(screen.getByLabelText('Watch history and resume')).not.toBeChecked();
    expect(api).toHaveBeenCalledWith(`${root}/${handle}`, 'DELETE');
  });

  it('locks Back and retries the identical body after an unknown apply outcome', async () => {
    let fail = true; const api = apiFactory();
    api.mockImplementation(async (path: string, method?: string) => method === 'DELETE' ? undefined : path.endsWith('/preview') ? addons() : path.endsWith('/review') ? review() : fail ? (fail = false, Promise.reject(new Error('private'))) : completion);
    mount(api as Client); await connect(); await items(); confirmStage();
    fireEvent.click(screen.getByLabelText('I confirm this import is for Synthetic profile.'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm import' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Retry this preview');
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm import' }));
    await screen.findByRole('heading', { name: 'Import complete' });
    const applies = api.mock.calls.filter(call => call[0].endsWith('/apply'));
    expect(applies).toHaveLength(2); expect((applies[0] as unknown[])[2]).toEqual((applies[1] as unknown[])[2]);
  });

  it('rejects stale profile responses and parent blocking', async () => {
    let resolve!: (value: ReturnType<typeof addons>) => void;
    const api = vi.fn(() => new Promise(r => { resolve = r; }));
    const view = mount(api as Client); credentials(); fireEvent.click(screen.getByRole('button', { name: 'Next: Choose add-ons' }));
    const signal = (api.mock.calls[0] as unknown[])[3] as AbortSignal;
    view.rerender(<StremioImport api={api as Client} profile="3" profileName="Replacement profile"/>);
    expect(signal.aborted).toBe(true);
    await act(async () => resolve(addons()));
    expect(screen.getByLabelText('Import progress')).toHaveTextContent('Step 1 of 4');
    view.unmount();
    const protectedApi = apiFactory();
    const protectedView = render(<ProtectedPresentation.Provider value={false}><StremioImport api={protectedApi as Client} profile="2" profileName="Synthetic profile"/></ProtectedPresentation.Provider>);
    await connect();
    protectedView.rerender(<ProtectedPresentation.Provider value={true}><StremioImport api={protectedApi as Client} profile="2" profileName="Synthetic profile"/></ProtectedPresentation.Provider>);
    expect(screen.queryByRole('heading', { name: 'Choose add-ons' })).not.toBeInTheDocument();
    expect(protectedApi).toHaveBeenCalledWith(`${root}/${handle}`, 'DELETE');
  });

  it('shows safe errors and refuses expired previews', async () => {
    let expired = false;
    const api = vi.fn(async () => { if (expired) return { ...addons(), expires_at: Math.floor(Date.now() / 1000) - 1 }; throw new ApiError('private upstream', 401, 'stremio_credentials_invalid'); });
    mount(api as Client); credentials(); fireEvent.click(screen.getByRole('button', { name: 'Next: Choose add-ons' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Stremio sign-in failed');
    expect(screen.queryByText('private upstream')).not.toBeInTheDocument();
    expired = true;
    credentials(); fireEvent.click(screen.getByRole('button', { name: 'Next: Choose add-ons' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('unexpected import review');
    expect(screen.getByLabelText('Import progress')).toHaveTextContent('Step 1 of 4');
  });

  it('refuses a restricted destination and unavailable add-ons', async () => {
    const api = apiFactory(); const view = render(<StremioImport api={api as Client} profile="2" profileName="Restricted" restricted/>);
    expect(screen.getByRole('status')).toHaveTextContent('Switch to an unrestricted profile');
    expect(screen.queryByLabelText('Stremio password')).not.toBeInTheDocument();
    view.unmount();
    const unavailable = { ...addon, status: 'unavailable', reason: 'unsupported_transport' };
    api.mockImplementation(async (path: string, method?: string) => method === 'DELETE' ? undefined : path.endsWith('/preview') ? { ...addons(), addons: [unavailable] } : review());
    mount(api as Client); await connect();
    expect(screen.getByLabelText('Use add-on Synthetic metadata')).toBeDisabled();
    expect(screen.getByLabelText('Use add-on Synthetic metadata')).not.toBeChecked();
    expect(screen.getByText('This add-on uses an unsupported connection method.')).toBeInTheDocument();
  });

  it('rejects a replaced review handle and duplicate item handles', async () => {
    const api = apiFactory();
    api.mockImplementation(async (path: string, method?: string) => method === 'DELETE' ? undefined : path.endsWith('/preview') ? addons() : { ...review(), preview_id: 'replacement_preview_123456789' });
    mount(api as Client); await connect(); fireEvent.click(screen.getByRole('button', { name: 'Next: Review items' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('unexpected import review');
    expect(screen.queryByRole('button', { name: 'Confirm import' })).not.toBeInTheDocument();
    cleanup();
    const duplicate = apiFactory(); duplicate.mockImplementation(async (path: string, method?: string) => method === 'DELETE' ? undefined : path.endsWith('/preview') ? addons() : { ...review(), review_items: [movie, movie] });
    mount(duplicate as Client); await connect(); fireEvent.click(screen.getByRole('button', { name: 'Next: Review items' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('unexpected import review');
  });

  it('rejects a missing or zero review revision before confirmation', async () => {
    const api = vi.fn(async (_path: string, _method?: string): Promise<unknown> => undefined);
    api.mockImplementation(async (path: string, method?: string) => method === 'DELETE' ? undefined : path.endsWith('/preview') ? addons() : { ...review(), review_revision: undefined });
    mount(api as Client); await connect(); fireEvent.click(screen.getByRole('button', { name: 'Next: Review items' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('unexpected import review');
    expect(screen.queryByRole('button', { name: 'Confirm import' })).not.toBeInTheDocument();
    cleanup();
    api.mockImplementation(async (path: string, method?: string) => method === 'DELETE' ? undefined : path.endsWith('/preview') ? addons() : { ...review(), review_revision: 0 });
    mount(api as Client); await connect(); fireEvent.click(screen.getByRole('button', { name: 'Next: Review items' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('unexpected import review');
    expect(api.mock.calls.some(call => call[0].endsWith('/apply'))).toBe(false);
  });

  it('aborts an in-flight review when the profile changes', async () => {
    let resolve!: (value: ReturnType<typeof review>) => void;
    const api = vi.fn((path: string, method?: string) => method === 'DELETE' ? Promise.resolve() : path.endsWith('/preview') ? Promise.resolve(addons()) : new Promise<ReturnType<typeof review>>(r => { resolve = r; }));
    const view = mount(api as Client); await connect(); fireEvent.click(screen.getByRole('button', { name: 'Next: Review items' }));
    const reviewCall = api.mock.calls.find(call => call[0].endsWith('/review'))!;
    const signal = (reviewCall as unknown[])[3] as AbortSignal;
    view.rerender(<StremioImport api={api as Client} profile="3" profileName="Replacement profile"/>);
    expect(signal.aborted).toBe(true);
    await act(async () => resolve(review()));
    expect(screen.queryByRole('heading', { name: 'Review items' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Stremio password')).toHaveValue('');
  });

  it('requires another review after a failed changed add-on verification', async () => {
    const api = apiFactory(); let reviews = 0;
    api.mockImplementation(async (path: string, method?: string) => {
      if (method === 'DELETE') return undefined;
      if (path.endsWith('/preview')) return addons();
      if (path.endsWith('/review')) { reviews++; if (reviews === 2) throw new ApiError('private', 503, 'stremio_addon_unavailable'); return review(reviews === 1 ? 1 : 2); }
      return completion;
    });
    mount(api as Client); await connect(); await items(); fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' })); fireEvent.click(screen.getByRole('button', { name: 'Next: Review items' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Change your add-on choices');
    fireEvent.click(screen.getByRole('button', { name: 'Select all' })); await items();
    expect(reviews).toBe(3);
    expect(api).toHaveBeenLastCalledWith(`${root}/${handle}/review`, 'POST', { selected_addons: [addon.item_id], expected_review_revision: 1 }, expect.any(AbortSignal));
    expect(screen.getByRole('heading', { name: 'Review items' })).toHaveFocus();
  });

  it('recovers from expiry after an unknown apply outcome without promising rollback', async () => {
    const short = () => ({ ...base(), expires_at: Math.floor(Date.now() / 1000) + 2 });
    const api = apiFactory();
    api.mockImplementation(async (path: string, method?: string) => method === 'DELETE' ? undefined : path.endsWith('/preview') ? { ...addons(), ...short() } : path.endsWith('/review') ? { ...review(), ...short() } : Promise.reject(new Error('unknown outcome')));
    mount(api as Client); await connect(); await items(); confirmStage();
    fireEvent.click(screen.getByLabelText('I confirm this import is for Synthetic profile.'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm import' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Retry this preview');
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Connect Stremio' })).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.getByRole('alert')).toHaveTextContent('Some changes may already have been saved');
    expect(screen.getByLabelText('Stremio password')).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Confirm import' })).not.toBeInTheDocument();
  });

  it('shows the failing add-on by name from an HTTP error and retries with that add-on unchecked', async () => {
    let reviewCalls = 0;
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('/preview')) return new Response(JSON.stringify(addons()), { status: 200 });
      if (url.endsWith('/review')) {
        reviewCalls++;
        if (reviewCalls === 1) return new Response(JSON.stringify({ error_code: 'stremio_addon_unavailable', error: 'private https://source.invalid', failed_addon_items: [addon.item_id] }), { status: 502 });
        expect(JSON.parse(String(options?.body))).toEqual({ selected_addons: [], expected_review_revision: 0 });
        return new Response(JSON.stringify({ ...review(), addons_to_add: 0 }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { api } = createAccountClient(vi.fn()); mount(api); await connect();
    fireEvent.click(screen.getByRole('button', { name: 'Next: Review items' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Change your add-on choices');
    expect(screen.getByText('Could not verify this add-on. Uncheck it or continue without add-ons.')).toBeInTheDocument();
    expect(screen.getByLabelText('Use add-on Synthetic metadata')).toBeChecked();
    expect(screen.queryByText('private https://source.invalid')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Use add-on Synthetic metadata'));
    fireEvent.click(screen.getByRole('button', { name: 'Next: Review items' }));
    await screen.findByRole('heading', { name: 'Review items' });
    expect(reviewCalls).toBe(2);
    expect(fetchMock.mock.calls.some(call => call[0].endsWith('/apply'))).toBe(false);
  });
});
