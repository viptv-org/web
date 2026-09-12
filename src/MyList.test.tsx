// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {it,expect,vi} from 'vitest';
import {MyList} from './MyList';
import type {Client} from './lib/api';
it('pages a saved library and removes one item without fetching the entire library',async()=>{
 const calls:string[]=[];let removed=false;
 const api=vi.fn(async(path:string,method?:string)=>{calls.push(`${method??'GET'} ${path}`);if(method==='DELETE'){removed=true;return {ok:true}}return {items:removed?[]:[{id:'tt1',type:'movie',name:'Saved film'}],total:21,next_offset:path.includes('offset=20')?null:20}}) as Client;
 render(<MyList api={api} profile="1"/>);
 expect(await screen.findByText('Saved film')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Next'}));
 await waitFor(()=>expect(calls).toContain('GET /profiles/1/favorites/page?limit=20&offset=20'));
 fireEvent.click(screen.getByRole('button',{name:'Remove Saved film'}));
 await waitFor(()=>expect(calls).toContain('DELETE /profiles/1/favorites/movie/tt1'));
 expect(await screen.findByText('Removed from My List.')).toBeInTheDocument();
 expect(calls).not.toContain('GET /profiles/1/favorites');
});
