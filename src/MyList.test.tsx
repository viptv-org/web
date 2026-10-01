// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {render,screen,fireEvent,waitFor,within} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {MyList} from './MyList';
import {stubIntersections} from './test-intersections';
import type {Client} from './lib/api';
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks()});
function library(total:number){
 const calls:string[]=[];let titles=Array.from({length:total},(_,i)=>({id:`tt${i}`,type:'movie',name:`Saved ${String(i).padStart(3,'0')}`}));
 const api=vi.fn(async(path:string,method?:string)=>{calls.push(`${method??'GET'} ${path}`);
  if(method==='DELETE'){const id=path.split('/').at(-1);titles=titles.filter(t=>t.id!==id);return {ok:true}}
  const query=new URLSearchParams(path.split('?')[1]);const offset=Number(query.get('offset')),limit=Number(query.get('limit'));
  return {items:titles.slice(offset,offset+limit),offset,total:titles.length,next_offset:offset+limit<titles.length?offset+limit:null}}) as Client;
 return {api,calls};
}
it('loads the next saved titles near the end of the list without a pager',async()=>{
 const edges=stubIntersections();const {api,calls}=library(45);
 render(<MyList api={api} profile="1"/>);
 expect(await screen.findByText('Saved 000')).toBeInTheDocument();
 expect(screen.queryByRole('button',{name:/^(Next|Previous)/})).not.toBeInTheDocument();
 const list=screen.getByRole('list',{name:'Saved titles'});
 expect(within(list).getAllByRole('listitem')).toHaveLength(20);
 await edges.reach(list,'end');
 expect(await screen.findByText('Saved 039')).toBeInTheDocument();
 expect(calls).toContain('GET /profiles/1/favorites/page?limit=20&offset=20');
 fireEvent.click(screen.getByRole('button',{name:'Remove Saved 010'}));
 expect(await screen.findByText('Removed from My List.')).toBeInTheDocument();
 expect(calls).toContain('DELETE /profiles/1/favorites/movie/tt10');
 expect(screen.queryByText('Saved 010')).not.toBeInTheDocument();
 expect(screen.getByText('44 saved titles')).toBeInTheDocument();
 // The removal shifted later rows up by one on the server.
 await edges.reach(list,'end');
 expect(await screen.findByText('Saved 044')).toBeInTheDocument();
 expect(calls).toContain('GET /profiles/1/favorites/page?limit=20&offset=39');
 expect(within(list).getAllByRole('listitem')).toHaveLength(44);
 expect(edges.waiting(list,'end')).toBe(false);
 expect(calls.some(call=>call.endsWith('/favorites'))).toBe(false);
});
it('keeps at most 100 saved titles rendered and reloads evicted ones before the list',async()=>{
 const edges=stubIntersections();const {api,calls}=library(300);
 render(<MyList api={api} profile="1"/>);
 await screen.findByText('Saved 000');const list=screen.getByRole('list',{name:'Saved titles'});
 for(let page=1;page<=5;page++){await edges.reach(list,'end');await screen.findByText(`Saved ${String(page*20+19).padStart(3,'0')}`);}
 expect(within(list).getAllByRole('listitem')).toHaveLength(100);
 expect(screen.queryByText('Saved 019')).not.toBeInTheDocument();
 expect(screen.getByText('Saved 020')).toBeInTheDocument();
 await edges.reach(list,'start');
 expect(await screen.findByText('Saved 000')).toBeInTheDocument();
 expect(calls.at(-1)).toBe('GET /profiles/1/favorites/page?limit=20&offset=0');
 expect(within(list).getAllByRole('listitem')).toHaveLength(100);
 expect(screen.queryByText('Saved 100')).not.toBeInTheDocument();
 expect(edges.waiting(list,'start')).toBe(false);
});
it('keeps the first visible saved title in place when rows above it are evicted or reloaded',async()=>{
 const edges=stubIntersections();const {api}=library(300);let scrolled=0;
 // Each row is 100px tall in document order; the window viewport starts at `scrolled`.
 vi.spyOn(Element.prototype,'getBoundingClientRect').mockImplementation(function(this:Element){
  const index=this.tagName==='LI'&&this.parentElement?[...this.parentElement.children].indexOf(this):-1;
  const top=index<0?0:index*100-scrolled;return {top,bottom:index<0?0:top+100,left:0,right:0,width:0,height:index<0?0:100,x:0,y:top,toJSON(){}} as DOMRect;
 });
 const scrollBy=vi.spyOn(window,'scrollBy').mockImplementation(((_:number,y:number)=>{scrolled+=y}) as typeof window.scrollBy);
 render(<MyList api={api} profile="1"/>);
 await screen.findByText('Saved 000');const list=screen.getByRole('list',{name:'Saved titles'});
 for(let page=1;page<=4;page++){await edges.reach(list,'end');await screen.findByText(`Saved ${String(page*20+19).padStart(3,'0')}`);}
 scrolled=9000;fireEvent.scroll(window);
 await edges.reach(list,'end');await screen.findByText('Saved 119');
 expect(scrollBy).toHaveBeenLastCalledWith(0,-2000);
 expect(screen.getByText('Saved 090').closest('li')!.getBoundingClientRect().top).toBe(0);
 await edges.reach(list,'start');await screen.findByText('Saved 000');
 expect(scrollBy).toHaveBeenLastCalledWith(0,2000);
 expect(screen.getByText('Saved 090').closest('li')!.getBoundingClientRect().top).toBe(0);
});
