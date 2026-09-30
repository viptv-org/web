import { useState, type ReactNode } from 'react';
import { Menu, LogOut } from 'lucide-react';
import { Button } from './components/ui/button';
import { Modal } from './shared';

export const ACCOUNT_PAGES = ['Account', 'Devices', 'Continue Watching', 'My List', 'History', 'Add-ons', 'Xtream connections', 'VOD matches', 'Gateways'] as const;
export const OPERATOR_PAGES = ['Overview', 'Accounts', 'Gateway grants'] as const;
export type AdminPage = typeof ACCOUNT_PAGES[number] | typeof OPERATOR_PAGES[number];
export function AdminShell({ page, owner, profile, navigate, signOut, children }: {
  page: AdminPage; owner: boolean; profile?: string; navigate: (page: AdminPage) => void; signOut: () => void; children: ReactNode;
}) {
  const [drawer, setDrawer] = useState(false);
  const nav = <nav aria-label="Main navigation">
    <div className="admin-nav-group"><h2>Your account</h2>{ACCOUNT_PAGES.map(name => <button type="button" className="admin-nav-link" key={name} aria-current={name === page ? 'page' : undefined} onClick={() => { navigate(name); setDrawer(false); }}>{name}</button>)}</div>
    {owner && <div className="admin-nav-group mt-5"><h2>Operator</h2>{OPERATOR_PAGES.map(name => <button type="button" className="admin-nav-link" key={name} aria-current={name === page ? 'page' : undefined} onClick={() => { navigate(name); setDrawer(false); }}>{name}</button>)}</div>}
  </nav>;
  return <div className="admin-shell">
    <aside className="admin-nav"><div className="admin-wordmark">VIPTV</div>{nav}<div className="admin-nav-footer"><p className="text-sm text-muted-foreground mb-3">{profile}</p><Button variant="ghost" onClick={signOut}><LogOut size={18} />Sign out</Button></div></aside>
    <div className="min-w-0">
      <header className="admin-mobile-head"><button type="button" aria-label="Open navigation" aria-expanded={drawer} onClick={() => setDrawer(true)}><Menu size={22} /></button><span className="admin-wordmark">VIPTV</span><button type="button" aria-label="Account settings" className="admin-nav-link" style={{ width: 'auto' }} onClick={() => navigate('Account')}>Account</button></header>
      <main className="admin-main" tabIndex={-1}><header className="admin-page-head"><div><h1>{page}</h1><p>{profile ? `Managing ${profile}` : 'Account and playback settings'}</p></div></header>{children}</main>
    </div>
    <Modal open={drawer} onOpenChange={setDrawer} title="Navigation" description="Choose an account or operator section."><div className="admin-nav-group">{nav}<Button variant="ghost" onClick={signOut}><LogOut size={18} />Sign out</Button></div></Modal>
  </div>;
}
