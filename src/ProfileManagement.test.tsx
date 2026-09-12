// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {cleanup} from "@testing-library/react";
import {afterEach} from "vitest";
afterEach(cleanup);
import {render,screen,fireEvent} from '@testing-library/react';
import {describe,it,expect,vi} from 'vitest';
import {ProfileScreen} from './AccountScreens';
const profiles=[{id:'1',name:'Primary',is_primary:true},{id:'2',name:'Guest',is_primary:false}];
describe('household profile management',()=>{
 it('edits an existing profile without selecting it',async()=>{
 const update=vi.fn();const select=vi.fn();
 render(<ProfileScreen profiles={profiles} canCreate onSelect={select} onCreate={vi.fn()} onUpdate={update} onDelete={vi.fn()} onLogout={vi.fn()} busy={false}/>);
 fireEvent.click(screen.getByRole('button',{name:'Edit Guest'}));
 fireEvent.change(screen.getByLabelText('Profile name'),{target:{value:'Family'}});
 fireEvent.click(screen.getByRole('button',{name:'Save profile'}));
 await screen.findByRole('button',{name:'Edit Guest'});
 expect(update).toHaveBeenCalledWith(profiles[1],'Family','critters');expect(select).not.toHaveBeenCalled();
 });
 it('protects primary and confirms deletion with an explicit cancel path',async()=>{
 const remove=vi.fn();
 render(<ProfileScreen profiles={profiles} canCreate onSelect={vi.fn()} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={remove} onLogout={vi.fn()} busy={false}/>);
 expect(screen.queryByRole('button',{name:'Delete Primary'})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Delete Guest'}));
 expect(remove).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Keep profile'}));
 expect(remove).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Delete Guest'}));
 fireEvent.click(screen.getByRole('button',{name:'Delete profile permanently'}));
 await screen.findByRole('button',{name:'Edit Guest'});expect(remove).toHaveBeenCalledWith(profiles[1]);
 });
});
