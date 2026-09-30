import {useRef,useState,type ReactNode} from 'react';
import {Inbox,LoaderCircle,Eye,EyeOff} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
export const words=(text:string)=>text.replaceAll('_',' ');
export function Field({label,...props}:{label:string}&React.ComponentProps<typeof Input>){
 const[visible,setVisible]=useState(false);
 return <label className="grid min-w-0 flex-1 gap-2 text-sm font-medium"><span>{label}</span>{props.type==='password'?<span className="relative block"><Input {...props} type={visible?'text':'password'} className={`${props.className??''} pr-12`}/><button type="button" disabled={props.disabled} className="absolute right-1 top-0 grid h-12 w-11 place-items-center" aria-label={`${visible?'Hide':'Show'} ${label.toLowerCase()}`} onClick={()=>setVisible(value=>!value)}>{visible?<EyeOff size={18} aria-hidden="true"/>:<Eye size={18} aria-hidden="true"/>}</button></span>:<Input {...props}/>}</label>
}
export function Modal({title,description,open,onOpenChange,children}:{title:string;description:string;open:boolean;onOpenChange:(v:boolean)=>void;children:ReactNode}){
 const wasOpen=useRef(false);const opener=useRef<HTMLElement|null>(null);
 if(open&&!wasOpen.current&&typeof document!=='undefined')opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
 wasOpen.current=open;
 return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent onCloseAutoFocus={event=>{event.preventDefault();if(opener.current?.isConnected)opener.current.focus();else document.querySelector<HTMLElement>('.admin-main')?.focus()}} className="max-h-[calc(100dvh-1rem)] overflow-y-auto overscroll-contain p-4 sm:p-6 sm:max-w-[460px]"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>{children}</DialogContent></Dialog>
}
export function Empty({title='Nothing here yet',children}:{title?:string;children?:ReactNode}){return <div className="flex flex-col items-center gap-3 p-8 text-sm text-muted-foreground"><Inbox size={28}/><strong>{title}</strong>{children}</div>}
export function Feedback({error,success}:{error?:string;success?:string}){return <>{error&&<div role="alert" className="rounded-md border border-destructive p-3 text-sm text-destructive">{error}</div>}{success&&<div role="status" className="rounded-md border p-3 text-sm">{success}</div>}</>}
export function Resource({loading,error,reload,children}:{loading:boolean;error:string;reload:()=>void;children:ReactNode}){if(loading)return <div role="status" aria-label="Loading" className="space-y-4"><div className="h-16 rounded-md bg-muted animate-pulse"/><div className="h-16 rounded-md bg-muted animate-pulse"/></div>;if(error)return <div className="space-y-4"><Feedback error={error}/><Button variant="outline" onClick={reload}>Try again</Button></div>;return <>{children}</>}
export function Submit({busy,children}:{busy:boolean;children:ReactNode}){return <Button type="submit" disabled={busy}>{busy&&<LoaderCircle className="animate-spin" size={15}/>} {busy?'Working…':children}</Button>}
