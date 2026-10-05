// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {ItemReview} from './StremioReview';

afterEach(cleanup);
const base={item_id:'synthetic_watched_episode',name:'Verified episode',type:'series' as const,season:2,episode:3,favorite_action:'none' as const,progress_action:'add' as const,status:'ready' as const,counts:{favorites_to_add:0,progress_to_add:1,progress_to_update:0,existing_preserved:0,already_imported:0},selectable:true};

it('reviews an undated completion as importable watched state, not a fabricated resume',()=>{
 render(<ItemReview items={[{...base,watched:true,watch_date_known:false,position:0,duration:0,completion_only:true,resume_active:false}]} excluded={new Set()} onChange={()=>{}} disabled={false}/>);
 expect(screen.getByText('Watched · watch date unavailable')).toBeInTheDocument();
 expect(screen.getByText('Completion only — does not change Continue Watching')).toBeInTheDocument();
 expect(screen.getByRole('checkbox',{name:'Include Verified episode season 2 episode 3'})).toBeChecked();
 expect(screen.queryByText(/^Resume /)).not.toBeInTheDocument();
});

it('reviews a previously watched item with its active rewatch position',()=>{
 render(<ItemReview items={[{...base,watched:true,watch_date_known:false,position:24,duration:120,completion_only:false,resume_active:true}]} excluded={new Set()} onChange={()=>{}} disabled={false}/>);
 expect(screen.getByText('Watched · Rewatch in progress · watch date unavailable')).toBeInTheDocument();
 expect(screen.getByText('Resume 0:24 of 2:00')).toBeInTheDocument();
 expect(screen.queryByText('Completion only — does not change Continue Watching')).not.toBeInTheDocument();
});
