import {Button} from '@/components/ui/button';
import type {Addon} from './lib/api';
export function AddonSettings({addon,busy,update}:{addon:Addon;busy:boolean;update:(patch:{enabled?:boolean})=>void}) {
 return <Button role="switch" aria-label={`Enable ${addon.name}`} aria-checked={addon.enabled} variant="outline" disabled={busy} onClick={()=>update({enabled:!addon.enabled})}>{addon.enabled?'Disable':'Enable'}</Button>;
}
