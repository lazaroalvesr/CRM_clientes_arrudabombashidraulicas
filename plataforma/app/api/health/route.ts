import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET(){
  try{const {error}=await supabaseAdmin().from('users').select('id',{head:true,count:'exact'});if(error)throw error;return NextResponse.json({ok:true});}
  catch{return NextResponse.json({ok:false,error:'Banco Supabase indisponível.'},{status:503});}
}
