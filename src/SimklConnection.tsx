import {useEffect, useMemo, useRef} from 'react';
import type {Client} from './lib/api';
import {simklClient} from './lib/simklApi';
import {useAction, useResource} from './hooks';
import {Card} from './components/ui/card';
import {Button} from './components/ui/button';
import {Feedback} from './shared';

export function SimklConnection({api, profile, onAuthorize = (url: string) => window.location.assign(url)}: {
  api: Client; profile: string; onAuthorize?: (url: string) => void;
}) {
  const client = useMemo(() => simklClient(api, profile), [api, profile]);
  const statusApi = useMemo(() => (async (_path: string, _method?: string, _body?: unknown, signal?: AbortSignal) => client.status(signal)) as Client, [client]);
  const resource = useResource<Awaited<ReturnType<typeof client.status>>>(statusApi, 'status');
  const action = useAction();
  const controller = useRef(new AbortController());
  useEffect(() => {
    const owned = new AbortController(); controller.current = owned;
    return () => owned.abort();
  }, [client]);
  const status = resource.data;
  async function authorize() {
    const signal = controller.current.signal;
    const url = await client.authorize(signal);
    if (!signal.aborted) onAuthorize(url);
  }
  async function disconnect() {
    const signal = controller.current.signal;
    await client.disconnect(signal);
    if (!signal.aborted) resource.reload();
  }
  return <Card className="p-6 space-y-4">
    <h2>SIMKL · This profile</h2>
    <p>This connection belongs to this VIPTV profile. Linking keeps existing VIPTV history and saved titles unchanged.</p>
    <Feedback error={action.error || resource.error} success={action.success}/>
    {resource.loading ? <p>Loading connection…</p> : status?.linked ? <>
      <p>Linked to SIMKL.</p>
      {!!status.tracking?.pending && <p>{status.tracking.pending} playback updates pending.</p>}
      {!!status.tracking?.failed && <p>{status.tracking.failed} playback updates could not be sent. A later playback update can retry.</p>}
      <div className="flex flex-wrap gap-3"><Button variant="outline" disabled={action.busy} onClick={() => void action.run(disconnect, 'SIMKL disconnected. VIPTV history and saved titles retained.')}>Disconnect SIMKL</Button></div>
    </> : <Button disabled={action.busy || resource.loading || !status?.configured} onClick={() => void action.run(authorize, '')}>Link SIMKL</Button>}
    {status?.configured === false && <p>SIMKL is not configured on this server.</p>}
  </Card>;
}
