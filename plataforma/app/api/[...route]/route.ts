import { NextRequest } from 'next/server';
import legacyHandler from '../../../api/[...route].mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';

async function handle(request:NextRequest,{params}:{params:Promise<{route:string[]}>}){
  const {route}=await params;
  let body:any={};
  if(request.method!=='GET'&&request.method!=='HEAD'){try{body=await request.json()}catch{body={}}}
  const headers=Object.fromEntries(request.headers.entries());
  let status=200,payload='',sentHeaders:Record<string,string>={};
  const response={setHeader:(key:string,value:string)=>{sentHeaders[key]=value},end:(value:string)=>{payload=value},set statusCode(value:number){status=value},get statusCode(){return status}};
  await legacyHandler({method:request.method,headers,query:{route},body},response);
  return new Response(payload,{status,headers:sentHeaders});
}
export const GET=handle; export const POST=handle; export const PATCH=handle;
