// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {describe,it,expect,vi,afterEach} from 'vitest';
import {ViewingQueue} from './ViewingQueue';
import type {Client} from './lib/api';
afterEach(cleanup);
describe('ViewingQueue',()=>{
 it('pages titles and removes/restores a series without deleting progress',async()=>{
  const calls:{path:string;method?:string;body?:unknown}[]=[];let hidden=false;
  const item={id:'actual-next',type:'series',series_id:'series-1',name:'Show',season:2,episode:1,queue_status:'next'};
  const api:Client=vi.fn(async(path,method,body)=>{calls.push({path,method,body});if(path.endsWith('/settings'))return {autoplay:true};if(path.endsWith('/visibility')){hidden=(body as {hidden:boolean}).hidden;return {ok:true}}return {items:hidden?[]:[item],offset:path.includes('offset=20')?20:0,total:21,next_offset:path.includes('offset=20')?null:20}}) as Client;
  render(<ViewingQueue api={api} profile="1"/>);
  expect(await screen.findByText('Up next · S2 E1')).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Next'}));
  await waitFor(()=>expect(calls.some(c=>c.path.endsWith('offset=20'))).toBe(true));
  fireEvent.click(screen.getByRole('button',{name:'Remove'}));
  fireEvent.click(await screen.findByRole('button',{name:'Undo removal of Show'}));
  await waitFor(()=>expect(calls.filter(c=>c.path.endsWith('/visibility')).map(c=>c.body)).toEqual([{id:'actual-next',type:'series',series_id:'series-1',hidden:true},{id:'actual-next',type:'series',series_id:'series-1',hidden:false}]));
  await waitFor(()=>expect(screen.queryByRole('button',{name:'Undo removal of Show'})).not.toBeInTheDocument());
  expect(await screen.findByRole('button',{name:'Remove'})).toBeEnabled();
  expect(calls.some(c=>c.method==='DELETE'||c.path.endsWith('/progress'))).toBe(false);
 });
});
