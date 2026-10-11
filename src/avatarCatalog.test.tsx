// @vitest-environment jsdom
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {AVATAR_COUNT,AVATAR_WORLDS,catalogAvatarUrl} from './avatarCatalog';
import {ProfileAvatar,ProfileScreen} from './AccountScreens';

afterEach(()=>{cleanup();vi.restoreAllMocks()});
const root=resolve(import.meta.dirname,'..');
const screenProps=()=>({canCreate:true,onSelect:vi.fn(),onCreate:vi.fn(),onUpdate:vi.fn(),onLogout:vi.fn(),busy:false});

describe('avatar catalog (ADM-004)',()=>{
 it('offers every design world with the summed count',()=>{
  expect(AVATAR_WORLDS).toHaveLength(16);expect(AVATAR_COUNT).toBe(624);
  render(<ProfileScreen {...screenProps()} profiles={[]}/>);
  expect(screen.getByText('624 avatars. Pick a world, then pick your character.')).toBeInTheDocument();
  for(const world of AVATAR_WORLDS)expect(screen.getByRole('button',{name:world.name})).toBeInTheDocument();
 });
 it('resolves every choice to served artwork and rejects unknown selections',()=>{
  for(const world of AVATAR_WORLDS)for(let choice=1;choice<=world.count;choice++){const src=catalogAvatarUrl(world.style,choice);expect(src,`${world.style} ${choice}`).toMatch(/^\/avatars\/avatar-(catalog|characters)\//);expect(existsSync(resolve(root,'public',src!.slice(1))),src).toBe(true)}
  expect(catalogAvatarUrl('disney',15)).toBeUndefined();expect(catalogAvatarUrl('critters',49)).toBeUndefined();expect(catalogAvatarUrl('retired',1)).toBeUndefined();expect(catalogAvatarUrl('critters',null)).toBeUndefined();
 });
 it('pages within a world and wraps',()=>{
  render(<ProfileScreen {...screenProps()} profiles={[]}/>);
  fireEvent.click(screen.getByRole('button',{name:'Creatures'}));
  expect(screen.getByText('Creatures · 1 / 3')).toBeInTheDocument();expect(screen.getByLabelText('Creatures 18')).toBeInTheDocument();expect(screen.queryByLabelText('Creatures 19')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Previous'}));
  expect(screen.getByText('Creatures · 3 / 3')).toBeInTheDocument();expect(screen.getByLabelText('Creatures 48')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Villains'}));
  expect(screen.getByText('Villains · 1 / 1')).toBeInTheDocument();expect(screen.getByLabelText('Villains 12')).toBeInTheDocument();
 });
 it('shows the saved choice and preserves a legacy avatar when not changed',async()=>{
  const p=screenProps();const saved={id:'2',name:'Guest',avatar_style:'villains',avatar_choice:4};const legacy={id:'3',name:'Old',avatar_style:'lorelei',avatar_choice:null,avatar_url:'https://api.dicebear.com/10.x/lorelei/png?seed=random'};
  render(<ProfileScreen {...p} profiles={[saved,legacy]}/>);
  fireEvent.click(screen.getByRole('button',{name:'Edit Guest'}));
  expect(screen.getByLabelText('Villains 4')).toBeChecked();
  fireEvent.click(screen.getByRole('button',{name:'Save profile'}));
  await waitFor(()=>expect(p.onUpdate).toHaveBeenCalledWith(saved,'Guest',{style:'villains'}));
 });
 it('renders packaged artwork before the supplied URL',()=>{
  const {container}=render(<ProfileAvatar profile={{name:'Ada',avatar_style:'princesses',avatar_choice:2,avatar_url:'https://static.wikia.nocookie.net/disney/images/x.png'}}/>);
  expect(container.querySelector('img')).toHaveAttribute('src',catalogAvatarUrl('princesses',2));
 });
});
