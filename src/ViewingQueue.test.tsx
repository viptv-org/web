// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {render,screen,fireEvent,waitFor,within} from '@testing-library/react';
import {describe,it,expect,vi,afterEach} from 'vitest';
import {ViewingQueue} from './ViewingQueue';
import {stubIntersections} from './test-intersections';
import type {Client} from './lib/api';
afterEach(()=>vi.unstubAllGlobals());
describe('ViewingQueue',()=>{
 it('auto-loads titles and removes/restores a series in place without deleting progress',async()=>{
  const edges=stubIntersections();
  const calls:{path:string;method?:string;body?:unknown}[]=[];let hidden=false;
  const item={id:'actual-next',type:'series',series_id:'series-1',name:'Show',season:2,episode:1,queue_status:'next'};
  const rows=Array.from({length:21},(_,i)=>i===1?item:{id:`movie-${i}`,type:'movie',name:`Movie ${i}`});
  const api:Client=vi.fn(async(path,method,body)=>{calls.push({path,method,body});if(path.endsWith('/settings'))return {autoplay:true};if(path.endsWith('/visibility')){hidden=(body as {hidden:boolean}).hidden;return {ok:true}}
   const visible=rows.filter(row=>!hidden||row!==item);const offset=Number(new URLSearchParams(path.split('?')[1]).get('offset'));
   return {items:visible.slice(offset,offset+20),offset,total:visible.length,next_offset:offset+20<visible.length?offset+20:null}}) as Client;
  render(<ViewingQueue api={api} profile="1"/>);
  expect(await screen.findByText('Up next · S2 E1')).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:/^(Next|Previous)$/})).not.toBeInTheDocument();
  const list=screen.getByRole('list',{name:'Continue Watching titles'});
  await edges.reach(list,'end');
  expect(await screen.findByText('Movie 20')).toBeInTheDocument();
  expect(calls.some(c=>c.path.endsWith('page?limit=20&offset=20'))).toBe(true);
  fireEvent.click(within(within(list).getAllByRole('listitem')[1]).getByRole('button',{name:'Remove'}));
  fireEvent.click(await screen.findByRole('button',{name:'Undo removal of Show'}));
  await waitFor(()=>expect(calls.filter(c=>c.path.endsWith('/visibility')).map(c=>c.body)).toEqual([{id:'actual-next',type:'series',series_id:'series-1',hidden:true},{id:'actual-next',type:'series',series_id:'series-1',hidden:false}]));
  await waitFor(()=>expect(screen.queryByRole('button',{name:'Undo removal of Show'})).not.toBeInTheDocument());
  expect(within(within(list).getAllByRole('listitem')[1]).getByText('Show')).toBeInTheDocument();
  expect(within(list).getAllByRole('button',{name:'Remove'})[1]).toBeEnabled();
  expect(screen.getByText('21 titles · Managed separately for each profile')).toBeInTheDocument();
  expect(calls.some(c=>c.method==='DELETE'||c.path.endsWith('/progress'))).toBe(false);
 });
});
