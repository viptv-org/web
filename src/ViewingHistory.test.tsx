// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {it,expect,vi} from 'vitest';
import {ViewingHistory} from './ViewingHistory';
import type {Client} from './lib/api';
it('corrects a watched episode and its resume position with exact episode identity',async()=>{
 const writes:unknown[]=[];const item={id:'episode:3',series_id:'series-1',type:'series',name:'Series',season:1,episode:3,position:100,duration:100};
 const api=vi.fn(async(path:string,method?:string,body?:unknown)=>{if(method==='PUT'){writes.push(body);return {ok:true}}return {items:[item],total:1,next_offset:null}}) as Client;
 render(<ViewingHistory api={api} profile="7"/>);
 fireEvent.click(await screen.findByRole('button',{name:'Mark unwatched'}));
 await screen.findByText('Viewing progress updated.');
 expect(writes[0]).toMatchObject({id:'episode:3',series_id:'series-1',action:'unwatched'});
 fireEvent.change(screen.getByLabelText('Resume at (seconds)'),{target:{value:'24'}});
 fireEvent.click(screen.getByRole('button',{name:'Save position'}));
 await waitFor(()=>expect(writes[1]).toMatchObject({id:'episode:3',series_id:'series-1',action:'position',position:24}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Save position'})).not.toBeDisabled());
});
