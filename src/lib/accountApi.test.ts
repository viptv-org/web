// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from 'vitest';
import {createAccountClient} from './accountApi';
function json(data:unknown,status=200) { return new Response(JSON.stringify(data),{status}); }
afterEach(() => {vi.restoreAllMocks();vi.unstubAllGlobals();});
describe('cookie account client', () => {
 it('registers with cookies, never adds bearer auth, and never persists credentials', async () => {
  const local = vi.spyOn(Storage.prototype, 'setItem');
  const f = vi.fn(async () => json({})); vi.stubGlobal('fetch', f);
  const c = createAccountClient(vi.fn());
  await c.api('/auth/register', 'POST', {username:'viewer',name:'Viewer',password:'long-password'});
  expect(f).toHaveBeenLastCalledWith('/api/auth/register', expect.objectContaining({credentials:'include',headers:{'Content-Type':'application/json'},body:'{"username":"viewer","name":"Viewer","password":"long-password"}'}));
  expect(String(JSON.stringify(f.mock.calls))).not.toContain('Authorization');
  expect(local).not.toHaveBeenCalled();
 });
 it('uses cookies and memory CSRF without a bearer header', async () => {
  const f=vi.fn().mockResolvedValueOnce(json({csrf_token:'csrf'})).mockResolvedValueOnce(json({}));vi.stubGlobal('fetch',f);
  const c=createAccountClient(vi.fn());await c.api('/auth/status');await c.api('/auth/login','POST',{username:'a',password:'b'});
  expect(f).toHaveBeenLastCalledWith('/api/auth/login',expect.objectContaining({credentials:'include',headers:{'Content-Type':'application/json','X-CSRF-Token':'csrf'}}));
 });
 it('rotates once for concurrent rejected requests', async () => {
  let rotated=false;let calls=0;
  const f=vi.fn(async(url:string) => { if(url==='/api/auth/refresh'){calls++;rotated=true;return json({csrf_token:'new'});} return rotated?json([]):json({},401); });vi.stubGlobal('fetch',f);
  const c=createAccountClient(vi.fn());await Promise.all([c.api('/profiles'),c.api('/accounts')]);expect(calls).toBe(1);
 });
 it('expires after one refresh plus one rejected retry, without loops', async () => {
  const expired=vi.fn();const f=vi.fn(async(url:string)=>url==='/api/auth/refresh'?json({}):json({},401));vi.stubGlobal('fetch',f);
  await expect(createAccountClient(expired).api('/profiles')).rejects.toMatchObject({status:401});expect(expired).toHaveBeenCalledTimes(1);expect(f).toHaveBeenCalledTimes(3);
 });
 it('does not refresh forbidden responses or rejected sign-in', async () => {
  const f=vi.fn().mockResolvedValueOnce(json({},403)).mockResolvedValueOnce(json({},401));vi.stubGlobal('fetch',f);const c=createAccountClient(vi.fn());
  await expect(c.api('/accounts')).rejects.toMatchObject({status:403});await expect(c.api('/auth/login','POST',{})).rejects.toMatchObject({status:401});expect(f).toHaveBeenCalledTimes(2);
 });
 it('does not replay a mutation after an ambiguous network failure', async () => {
  const f=vi.fn().mockRejectedValue(new TypeError('Offline'));vi.stubGlobal('fetch',f);await expect(createAccountClient(vi.fn()).api('/profiles','POST',{name:'Viewer'})).rejects.toThrow('Offline');expect(f).toHaveBeenCalledTimes(1);
 });
 it('rejects stale successful replies after credentials are cleared', async () => {
  let resolve!:(value:Response)=>void;vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(done=>{resolve=done;})));const c=createAccountClient(vi.fn());const pending=c.api('/profiles');c.clear();resolve(json([{id:1,name:'old'}]));await expect(pending).rejects.toMatchObject({name:'AbortError'});
 });
 it('retains only safe failed add-on handles from a Stremio review HTTP error', async () => {
  const handle='synthetic_addon_123456789';
  const response={error_code:'stremio_addon_unavailable',error:'private https://source.invalid/token=secret',failed_addon_items:[handle,handle,'https://private.invalid',42,'x'.repeat(129)]};
  const f=vi.fn(async()=>json(response,502));vi.stubGlobal('fetch',f);
  const client=createAccountClient(vi.fn());
  await expect(client.api('/profiles/2/imports/stremio/synthetic_preview_123456789/review','POST',{selected_addons:[handle]})).rejects.toMatchObject({
   errorCode:'stremio_addon_unavailable',failedAddonItems:[handle],message:'An add-on could not be verified. Change your add-on choices and try again.'
  });
  await expect(client.api('/profiles/2/imports/stremio/preview','POST',{})).rejects.toMatchObject({failedAddonItems:[]});
  expect(f).toHaveBeenCalledTimes(2);
 });
});
