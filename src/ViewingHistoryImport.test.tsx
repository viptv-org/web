// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {ViewingHistory} from './ViewingHistory';
import type {Client} from './lib/api';

afterEach(cleanup);

it('labels completion-only imported history honestly without inventing a watch date',async()=>{
 const api=vi.fn(async()=>({items:[{id:'show:1:2',type:'series',series_id:'show',name:'Imported episode',season:1,episode:2,position:0,duration:0,watched:true,watch_date_known:false,completion_only:true,resume_active:false}],total:1,next_offset:null})) as Client;
 render(<ViewingHistory api={api} profile="7"/>);
 expect(await screen.findByText('Imported — date unknown')).toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Mark unwatched'})).toBeInTheDocument();
 expect(screen.queryByText(/Rewatch in progress/)).not.toBeInTheDocument();
});

it('keeps watched and rewatch progress visible together and clears import-only presentation after a correction',async()=>{
 const item={id:'movie',type:'movie',name:'Rewatched movie',position:24,duration:120,watched:true,resume_active:true,completion_only:false,watch_date_known:false};
 const api=vi.fn(async(_path:string,method?:string)=>method==='PUT'?{position:0,duration:120,watched:false,resume_active:false,completion_only:false,watch_date_known:true}:{items:[item],total:1,next_offset:null}) as Client;
 render(<ViewingHistory api={api} profile="7"/>);
 expect(await screen.findByText(/Watched · Rewatch in progress/)).toBeInTheDocument();
 expect(screen.getByLabelText('Resume at (seconds)')).toHaveValue(24);
 fireEvent.click(screen.getByRole('button',{name:'Mark unwatched'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Mark watched'})).toBeInTheDocument());
 expect(screen.queryByText(/Rewatch in progress/)).not.toBeInTheDocument();
});
