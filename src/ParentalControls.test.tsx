// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {ParentUnlock} from './ParentalControls';
import type {Client} from './lib/api';
afterEach(cleanup);
it('masks and clears a parent PIN on failed attempts and cancellation',async()=>{
 const api=vi.fn().mockRejectedValue(new Error('Incorrect PIN'));const cancel=vi.fn();const done=vi.fn();
 render(<ParentUnlock api={api as Client} onUnlocked={done} onCancel={cancel}/>);
 const field=screen.getByLabelText('Parent PIN');expect(field).toHaveAttribute('type','password');
 fireEvent.change(field,{target:{value:'1234'}});fireEvent.click(screen.getByRole('button',{name:'Unlock'}));
 await screen.findByText('Incorrect PIN');expect(field).toHaveValue('');expect(done).not.toHaveBeenCalled();
 fireEvent.change(field,{target:{value:'4321'}});fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
 expect(field).toHaveValue('');expect(cancel).toHaveBeenCalled();
});
it('saves an age ceiling and approves an exact title without asserting its rating',async()=>{
 const api=vi.fn(async(path:string,method?:string)=>{if(path==='/parent/status')return {pin_configured:true,unlocked:false,restricted:false};if(path.endsWith('/kids'))return {enabled:true,max_age:10};if(path.endsWith('/approvals'))return [];return {}});
 const {ParentalControls}=await import('./ParentalControls');
 render(<ParentalControls api={api as Client} profiles={[{id:'2',name:'Kids'}]}/>);
 fireEvent.change(await screen.findByLabelText('Maximum age'),{target:{value:'12'}});
 fireEvent.click(screen.getByRole('button',{name:'Save kids settings'}));
 await screen.findByText('Kids settings saved.');expect(api).toHaveBeenCalledWith('/profiles/2/kids','PUT',{enabled:true,max_age:12});
 fireEvent.click(screen.getByText('Use an exact title ID'));
 fireEvent.change(screen.getByLabelText('Exact title ID'),{target:{value:'tt1234567'}});
 fireEvent.click(screen.getByRole('button',{name:'Approve title'}));
 await screen.findByText('Title approval saved.');expect(api).toHaveBeenCalledWith('/profiles/2/approvals','POST',{id:'tt1234567',type:'movie',approved:true});
});
it('searches only on submit and approves the returned title identity',async()=>{
 const api=vi.fn(async(path:string)=>{if(path==='/parent/status')return {pin_configured:true};if(path.endsWith('/kids'))return {enabled:true,max_age:10};if(path.startsWith('/parent/search?'))return {items:[{id:'tt0241527',type:'movie',name:'Harry Potter'}]};return []});
 const {ParentalControls}=await import('./ParentalControls');render(<ParentalControls api={api as Client} profiles={[{id:'2',name:'Kids'}]}/>);
 fireEvent.change(await screen.findByLabelText('Find a title'),{target:{value:'Harry'}});
 expect(api.mock.calls.some(([path])=>path.startsWith('/parent/search?'))).toBe(false);
 fireEvent.click(screen.getByRole('button',{name:'Search titles'}));
 fireEvent.click(await screen.findByRole('button',{name:'Approve Harry Potter'}));
 await screen.findByText('Title approval saved.');
 expect(api).toHaveBeenCalledWith('/profiles/2/approvals','POST',{id:'tt0241527',type:'movie',approved:true});
 fireEvent.change(screen.getByLabelText('Find a title'),{target:{value:'Harry Potter 2'}});
 expect(screen.queryByRole('button',{name:'Approve Harry Potter'})).not.toBeInTheDocument();
 expect(api.mock.calls.filter(([path])=>path.startsWith('/parent/search?'))).toHaveLength(1);
});
it('aborts an obsolete search and ignores late results after the search type changes',async()=>{
 let complete!:(value:unknown)=>void;let signal:AbortSignal|undefined;
 const api=vi.fn(async(path:string,_method?:string,_body?:unknown,requestSignal?:AbortSignal)=>{if(path==='/parent/status')return {pin_configured:true};if(path.endsWith('/kids'))return {enabled:true,max_age:10};if(path.startsWith('/parent/search?')){signal=requestSignal;return new Promise(resolve=>{complete=resolve})}return []});
 const {ParentalControls}=await import('./ParentalControls');render(<ParentalControls api={api as Client} profiles={[{id:'2',name:'Kids'}]}/>);
 fireEvent.change(await screen.findByLabelText('Find a title'),{target:{value:'Harry'}});fireEvent.click(screen.getByRole('button',{name:'Search titles'}));
 fireEvent.change(screen.getByLabelText('Search type'),{target:{value:'series'}});expect(signal?.aborted).toBe(true);
 complete({items:[{id:'tt0241527',type:'movie',name:'Old movie result'}]});
 await new Promise(resolve=>setTimeout(resolve,0));expect(screen.queryByText('Old movie result')).not.toBeInTheDocument();
});
it('pages legacy approvals and revokes a title beyond the supported cap',async()=>{
 const api=vi.fn(async(path:string,method?:string)=>{if(path==='/parent/status')return {pin_configured:true};if(path.endsWith('/kids'))return {enabled:true,max_age:10};if(method==='POST')return {};if(path.endsWith('?offset=500'))return [{id:'legacy-last',type:'movie',name:'Legacy last'}];if(path.endsWith('/approvals'))return Array.from({length:500},(_,i)=>({id:`title-${i}`,type:'movie',name:`Title ${i}`}));return []});
 const {ParentalControls}=await import('./ParentalControls');render(<ParentalControls api={api as Client} profiles={[{id:'2',name:'Kids'}]}/>);
 const next=await screen.findByRole('button',{name:'Next approvals'});await waitFor(()=>expect(next).toBeEnabled());fireEvent.click(next);
 await screen.findByText('Legacy last');
 fireEvent.click(screen.getByRole('button',{name:'Revoke'}));
 await screen.findByText('Title approval saved.');
 expect(api).toHaveBeenCalledWith('/profiles/2/approvals','POST',{id:'legacy-last',type:'movie',approved:false});
 expect(screen.getByRole('button',{name:'Previous approvals'})).toBeEnabled();
 expect(screen.getByText(/Up to 500 approved titles/)).toBeInTheDocument();
});
