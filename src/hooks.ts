import {useEffect,useState,useCallback} from 'react';
import type {Client} from './lib/api';
export function useResource<T>(api:Client,path:string|null){const [data,setData]=useState<T>();const [error,setError]=useState('');const [loading,setLoading]=useState(false);const [version,setVersion]=useState(0);const reload=useCallback(()=>setVersion(v=>v+1),[]);useEffect(()=>{setData(undefined);setError('');if(!path){setLoading(false);return}const controller=new AbortController();setLoading(true);api<T>(path,'GET',undefined,controller.signal).then(value=>{if(!controller.signal.aborted)setData(value)}).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Request failed')}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});return()=>controller.abort()},[api,path,version]);return{data,error,loading,reload};}
export function useAction(){const[busy,setBusy]=useState(false);const[error,setError]=useState('');const[success,setSuccess]=useState('');async function run(action:()=>Promise<void>,message='Changes saved.'){setBusy(true);setError('');setSuccess('');try{await action();setSuccess(message)}catch(e){setError(e instanceof Error?e.message:'Request failed.')}finally{setBusy(false)}}return{busy,error,success,run,clear:()=>{setError('');setSuccess('')}}}

// Status polling keeps forms mounted and leaves draft edits intact.
export function useLiveResource<T>(api:Client,path:string,interval=2000){
 const[data,setData]=useState<T>();const[error,setError]=useState('');const[loading,setLoading]=useState(true);const[version,setVersion]=useState(0);
 const reload=useCallback(()=>setVersion(v=>v+1),[]);
 useEffect(()=>{const controller=new AbortController();setError('');api<T>(path,'GET',undefined,controller.signal).then(value=>{if(!controller.signal.aborted)setData(value)}).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Request failed')}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});return()=>controller.abort()},[api,path,version]);
 useEffect(()=>{if(!interval)return;const timer=setInterval(reload,interval);return()=>clearInterval(timer)},[interval,reload]);
 return{data,error,loading:loading&&!data,reload};
}
