import postgres from 'postgres';
export const db=()=>postgres(process.env.SUPABASE_DB_URL||'',{prepare:false,max:1});
export function score(segment:string,size:string,pumping:boolean,fleet:boolean,branches:boolean){const value=(segment==='Bombeamento de concreto'?30:segment==='Concreteira'?25:15)+(size==='Grande'?20:size==='Médio'?12:size==='Pequeno'?5:0)+(pumping?25:0)+(fleet?15:0)+(branches?10:0);return {score:value,priority:value>=75?'A':value>=45?'B':'C'};}
