import { useResource } from './hooks';
import { Feedback, Resource } from './shared';
import { Card } from './components/ui/card';
import type { Client } from './lib/api';

export function OperatorOverview({ api }: { api: Client }) {
  const health = useResource<{ ok?: boolean; status?: string }>(api, '/health');
  return <div className="space-y-5"><p className="text-sm text-muted-foreground">VIPTV manages accounts and catalogs. Playback processing belongs to your authorized independent gateways.</p><Card className="p-6"><h2>Backend availability</h2><Resource {...health}><Feedback error={health.error}/><p className="mt-3">{health.data?.ok === true || health.data?.status === 'ok' ? 'Backend reachable' : 'The backend answered. Gateway and provider readiness are checked in their own settings.'}</p></Resource></Card><Card className="p-6"><h2>Private by default</h2><p className="text-sm text-muted-foreground mt-3">Operator access does not grant other accounts your gateways. Use Gateway grants to give selected accounts access to registrations you own.</p></Card></div>;
}
