import { NextRequest,NextResponse } from 'next/server';
import postgres from 'postgres';
import { createHash } from 'node:crypto';
const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
export async function POST(req:NextRequest){const token=req.cookies.get('__Host-arruda_session')?.value;if(token&&process.env.SUPABASE_DB_URL){const db=postgres(process.env.SUPABASE_DB_URL,{prepare:false,max:1});await db.unsafe('DELETE FROM sessions WHERE token=$1',[hash(token)]);await db.end();}const res=NextResponse.json({ok:true});res.cookies.set('__Host-arruda_session','',{httpOnly:true,secure:true,maxAge:0,path:'/'});return res;}
