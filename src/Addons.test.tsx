// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Connections } from './Admin';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const addon = { id: 'addon/1', name: 'My catalog', manifest_url: 'https://addon.example/manifest.json', enabled: true, priority: 10 };
describe('addon configuration', () => {
  it('PATCHes enabled and keeps disabled addons visible', async () => {
    let row = { ...addon };
    const api = vi.fn().mockImplementation((path, method, body) => { if (method === 'PATCH') { row = { ...row, ...body }; return Promise.resolve(row); } return Promise.resolve([row]); });
    render(<Connections api={api} kind="addons"/>);
    const toggle = await screen.findByRole('switch', { name: 'Enable My catalog' });
    expect(toggle).toHaveAttribute('aria-checked', 'true'); fireEvent.click(toggle);
    await waitFor(() => expect(api).toHaveBeenCalledWith('/addons/addon%2F1', 'PATCH', { enabled: false }));
    await waitFor(() => expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false'));
    expect(screen.getByText('My catalog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch'));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/addons/addon%2F1', 'PATCH', { enabled: true }));
  });
  it('disables mutations while pending and shows PATCH errors without changing state', async () => {
    let reject!: (error: Error) => void;
    const pending = new Promise((_, fail) => { reject = fail; });
    const api = vi.fn().mockImplementation((_path, method) => method === 'PATCH' ? pending : Promise.resolve([addon]));
    render(<Connections api={api} kind="addons"/>); fireEvent.click(await screen.findByRole('switch'));
    expect(screen.getByRole('switch')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete My catalog' })).toBeDisabled();
    await act(async () => reject(new Error('Cannot update addon')));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot update addon');
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true'); expect(screen.getByRole('switch')).not.toBeDisabled();
  });
  it('has no priority control', async () => {
    const api=vi.fn().mockResolvedValue([addon]); render(<Connections api={api} kind="addons"/>);
    await screen.findByRole('switch'); expect(screen.queryByLabelText(/Priority/)).not.toBeInTheDocument();
  });
});
