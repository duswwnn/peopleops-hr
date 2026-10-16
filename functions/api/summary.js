import {authenticate,fail,json} from '../_lib/auth.js';
export async function onRequestGet({request,env}){try{
 await authenticate(request,env);
 const url=new URL(request.url);const month=url.searchParams.get('month')||new Date().toISOString().slice(0,7);
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return json({error:'월 형식이 올바르지 않습니다.'},400);
 const end=month+'-31';const start=month+'-01';
 const stats=await env.DB.prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN hire_date IS NOT NULL AND hire_date <= ? AND (termination_date IS NULL OR termination_date > ?) THEN 1 ELSE 0 END) AS active FROM employees`).bind(end,end).first();
 const hires=await env.DB.prepare('SELECT name,hire_date,department FROM employees WHERE hire_date BETWEEN ? AND ? ORDER BY hire_date').bind(start,end).all();
 const leaves=await env.DB.prepare('SELECT name,termination_date,department FROM employees WHERE termination_date BETWEEN ? AND ? ORDER BY termination_date').bind(start,end).all();
 return json({month,employees:Number(stats.total)||0,monthEnd:Number(stats.active)||0,hires:hires.results,leaves:leaves.results});
}catch(e){return fail(e);}}
