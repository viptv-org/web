// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {cleanup} from "@testing-library/react";
import {afterEach} from "vitest";
afterEach(cleanup);
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {describe,it,expect,vi} from 'vitest';
import {PlaybackPreferences} from './PlaybackPreferences';
import type {Client} from './lib/api';
const defaults={audio_language:'en',subtitle_language:'en',subtitles_enabled:false,subtitle_size:'normal',subtitle_style:'system',quality:'auto',autoplay:true};
describe('profile playback preferences',()=>{
 it('loads profile settings and saves deliberate language, captions and quality changes',async()=>{
 const api=vi.fn(async(_path:string,method?:string,body?:unknown)=>method==='PUT'?body:defaults) as unknown as Client;
 render(<PlaybackPreferences api={api} profile="2"/>);
 fireEvent.change(await screen.findByLabelText('Preferred audio'),{target:{value:'ja'}});
 expect(screen.queryByLabelText('Automatically play the next episode')).not.toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Maximum quality'),{target:{value:'720p'}});
 fireEvent.click(screen.getByLabelText('Start with subtitles enabled'));
 fireEvent.click(screen.getByRole('button',{name:'Save preferences'}));
 await screen.findByText('Playback preferences saved.');
 expect(api).toHaveBeenCalledWith('/profiles/2/preferences','PUT',{...defaults,audio_language:'ja',quality:'720p',subtitles_enabled:true});
 });
 it('discards a late settings response after switching profiles',async()=>{
 let old:(v:typeof defaults)=>void=()=>{};
 const api=vi.fn((path:string)=>path.includes('/1/')?new Promise(r=>{old=r}):Promise.resolve({...defaults,audio_language:'fr'})) as unknown as Client;
 const view=render(<PlaybackPreferences api={api} profile="1"/>);
 view.rerender(<PlaybackPreferences api={api} profile="2"/>);
 await screen.findByLabelText('Preferred audio');old(defaults);
 await waitFor(()=>expect(screen.getByLabelText('Preferred audio')).toHaveValue('fr'));
 });
});
