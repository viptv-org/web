export type Profile={id:string;name:string;avatar_style?:string;avatar_seed?:string;avatar_url?:string;setup_complete?:boolean;is_primary?:boolean;kids?:boolean;max_age?:number};
export type Client=<T>(path:string,method?:string,body?:unknown,signal?:AbortSignal)=>Promise<T>;
export class ApiError extends Error { constructor(message:string,public status:number,public errorCode?:string,public failedAddonItems:readonly string[]=[]){super(message);this.name='ApiError';} }
export const encode=encodeURIComponent;
export function safeImage(url?:string){if(!url)return undefined;try{const parsed=new URL(url);return ['https:','http:'].includes(parsed.protocol)?url:undefined}catch{return undefined}}
