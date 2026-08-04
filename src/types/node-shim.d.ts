declare module 'fs' { export function readFileSync(a:any,b?:any):any; export function writeFileSync(a:any,b:any):void; export function mkdirSync(a:any,b?:any):void; export function existsSync(a:any):boolean; export function unlinkSync(a:any):void; }
declare module 'http' { export function createServer(a:any):any; export type Server = any; }
declare module 'os' { export function homedir():string; }
declare module 'path' { export function join(...a:any[]):string; }
declare module 'commander' { export class Command { name(a:string):this; description(a:string):this; command(a:string):this; argument(a:string,b?:string):this; action(a:any):this; parseAsync(a?:any):Promise<void>; } }
declare module '@opencode-ai/plugin' { export type Plugin = any; }
declare module 'dgram' { export type Socket = any; export function createSocket(a:string):any; }
declare module 'undici' { export function fetch(a:any,b?:any):Promise<any>; }
declare const process:any;
declare const Buffer:any;
declare namespace NodeJS { type Timeout = any; }
// minimal undici fetch global
