import { NextRequest } from 'next/server';
import legacyHandler from '../../../api/[...route].mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(request: NextRequest) {
  let body: any = {};
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try { body = await request.json(); } catch { body = {}; }
  }
  const headers = Object.fromEntries(request.headers.entries());
  const query = Object.fromEntries(request.nextUrl.searchParams.entries());
  let status = 200, payload = '';
  const sentHeaders: Record<string,string> = {};
  const response = { setHeader:(key:string,value:string)=>{sentHeaders[key]=value}, end:(value:string)=>{payload=value}, set statusCode(value:number){status=value}, get statusCode(){return status} };
  await legacyHandler({ method:request.method, headers, query:{...query, route:['leads']}, body }, response);
  return new Response(payload, { status, headers:sentHeaders });
}
export const GET = handle;
export const POST = handle;
