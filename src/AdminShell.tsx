import { useState, type ReactNode } from 'react';
import { Menu, LogOut } from 'lucide-react';
import { Button } from './components/ui/button';
import { Modal } from './shared';

export const PROFILE_PAGES = ['Profile', 'Continue Watching', 'My List', 'History'] as const;
export const ACCOUNT_PAGES = ['Account', 'Import from Stremio', 'Devices', 'Add-ons', 'Xtream connections', 'VOD matches', 'Gateways'] as const;
export const OPERATOR_PAGES = ['Overview', 'Accounts', 'Gateway grants'] as const;
export type AdminPage = typeof PROFILE_PAGES[number] | typeof ACCOUNT_PAGES[number] | typeof OPERATOR_PAGES[number];
const pageLabel = (page: AdminPage) => page === 'Profile' ? 'Profile settings' : page === 'Account' ? 'Account settings' : page;
export function AdminShell({ page, owner, profile, navigate, signOut, children }: {
  page: AdminPage; owner: boolean; profile?: string; navigate: (page: AdminPage) => void; signOut: () => void; children: ReactNode;
}) {
  const [drawer, setDrawer] = useState(false);
  const profilePage = PROFILE_PAGES.some(name => name === page);
  const operatorPage = OPERATOR_PAGES.some(name => name === page);
  const links = (pages: readonly AdminPage[]) => pages.map(name => <button type="button" className="admin-nav-link" key={name} aria-current={name === page ? 'page' : undefined} onClick={() => { navigate(name); setDrawer(false); }}>{pageLabel(name)}</button>);
  const nav = <nav aria-label="Main navigation">
    <div className="admin-nav-group"><h2>Your profile</h2>{links(PROFILE_PAGES)}</div>
    <div className="admin-nav-group mt-5"><h2>Your account</h2>{links(ACCOUNT_PAGES)}</div>
    {owner && <div className="admin-nav-group mt-5"><h2>Operator</h2>{links(OPERATOR_PAGES)}</div>}
  </nav>;
  return <div className="admin-shell">
    <aside className="admin-nav"><div className="admin-wordmark">VIPTV</div>{nav}<div className="admin-nav-footer"><p className="text-sm text-muted-foreground mb-3">{profile}</p><Button variant="ghost" onClick={signOut}><LogOut size={18} />Sign out</Button></div></aside>
    <div className="min-w-0">
      <header className="admin-mobile-head"><button type="button" aria-label="Open navigation" aria-expanded={drawer} onClick={() => setDrawer(true)}><Menu size={22} /></button><span className="admin-wordmark">VIPTV</span><button type="button" aria-label="Account settings" className="admin-nav-link" style={{ width: 'auto' }} onClick={() => navigate('Account')}>Account</button></header>
      <main className="admin-main" tabIndex={-1}><header className="admin-page-head"><div><h1>{pageLabel(page)}</h1><p>{profilePage ? `For ${profile ?? 'your selected profile'}` : operatorPage ? 'Operator settings' : "Shared across your account's profiles"}</p></div></header>{children}</main>
    </div>
    <Modal open={drawer} onOpenChange={setDrawer} title="Navigation" description="Choose a profile, account or operator section."><div className="admin-nav-group">{nav}<Button variant="ghost" onClick={signOut}><LogOut size={18} />Sign out</Button></div></Modal>
  </div>;
}
