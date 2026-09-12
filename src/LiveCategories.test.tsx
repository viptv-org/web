// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {LiveCategories} from './LiveCategories';
import type {Client} from './lib/api';
afterEach(cleanup);
it('lets the owner persist category exclusions while explaining automatic foreign exclusions',async()=>{
 const data={require_schedule:true,categories:[{key:'USA PREMIUM',name:'USA Premium',count:20,enabled:true,reason:null},{key:'LAT CINE/PELICULAS',name:'LAT CINE/PELICULAS',count:29,enabled:true,reason:'foreign'}]};
 const api=vi.fn().mockImplementation(async(_path:string,method:string,body?:{category:string;enabled:boolean})=>{if(method==='PUT'&&body)data.categories[0].enabled=body.enabled;return data});
 render(<LiveCategories api={api as Client}/>);expect(api).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Live TV categories'}));
 const premium=await screen.findByRole('checkbox',{name:'Show USA Premium'});
 expect(screen.getByRole('checkbox',{name:'Show LAT CINE/PELICULAS'})).toBeDisabled();
 fireEvent.click(premium);
 await waitFor(()=>expect(api).toHaveBeenCalledWith('/live-policy','PUT',{category:'USA PREMIUM',enabled:false}));
 expect(await screen.findByText(/Hidden by you/)).toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Search categories'),{target:{value:'LAT'}});
 expect(screen.queryByRole('checkbox',{name:'Show USA Premium'})).not.toBeInTheDocument();
});
