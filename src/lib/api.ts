export type Profile={id:string;name:string;avatar_style?:string;avatar_seed?:string;avatar_url?:string;setup_complete?:boolean;is_primary?:boolean;kids?:boolean;max_age?:number};
export type ProviderScopes={enable_live?:boolean;enable_movies?:boolean;enable_series?:boolean};
export type ProviderPatch=ProviderScopes & {warp?:boolean;enabled?:boolean;max_connections?:number};
export type Provider=ProviderScopes & {warp?:boolean;id:string;name:string;url:string;username?:string;enabled:boolean;max_connections?:number};
export type Addon={id:string;name:string;manifest_url:string;enabled:boolean};
export type Candidate={vod_id?:string;id?:string;name?:string;title?:string;type?:string;provider_id?:string;source?:string;description?:string;filename?:string;size_bytes?:number;reported_languages?:string[];audio_language_status?:'unknown'|'unverified'|string};
export type Client=<T>(path:string,method?:string,body?:unknown,signal?:AbortSignal)=>Promise<T>;
export class ApiError extends Error { constructor(message:string,public status:number,public errorCode?:string){super(message);this.name='ApiError';} }
export const encode=encodeURIComponent;
export function safeImage(url?:string){if(!url)return undefined;try{const parsed=new URL(url);return ['https:','http:'].includes(parsed.protocol)?url:undefined}catch{return undefined}}
