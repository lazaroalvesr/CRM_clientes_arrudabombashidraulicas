import { NextRequest } from 'next/server';
import legacyHandler from '../../../../api/[...route].mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest){
  let body:any={};try{body=await request.json()}catch{body={}}
  const headers=Object.fromEntries(request.headers.entries());
  let status=200,payload='';const sentHeaders:Record<string,string>={};
  const response={setHeader:(key:string,value:string)=>{sentHeaders[key]=value},end:(value:string)=>{payload=value},set statusCode(value:number){status=value},get statusCode(){return status}};
  await legacyHandler({method:'POST',headers,query:{route:['forgot-password']},body},response);
  return new Response(payload,{status,headers:sentHeaders});
}
