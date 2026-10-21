import {authenticate,fail,json} from '../_lib/auth.js';
const datePattern=/^\d{4}-\d{2}-\d{2}$/;
function validDate(value){if(!value)return true;if(!datePattern.test(value))return false;const d=new Date(`${value}T00:00:00Z`);return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===value;}
const headers={ 'Cache-Control':'no-store' };
export async function onRequestGet({request,env}){
 try{
  await authenticate(request,env);
  const u=new URL(request.url);const id=u.searchParams.get('employee_id');
  if(id){
   const employeeId=Number(id);
   if(!Number.isSafeInteger(employeeId)||employeeId<1)return json({error:'직원 번호를 확인해 주세요.'},400);
   const row=await env.DB.prepare('SELECT probation_end_date,contract_end_date FROM employee_hr_schedule WHERE employee_id=?').bind(employeeId).first();
   return new Response(JSON.stringify({probation_end_date:row?.probation_end_date||'',contract_end_date:row?.contract_end_date||''}),{headers:{'Content-Type':'application/json; charset=utf-8',...headers}});
  }
  const results=(await env.DB.prepare(`SELECT e.id,e.name,e.employee_no,e.department,e.workplace,s.probation_end_date,s.contract_end_date
     FROM employees e JOIN employee_hr_schedule s ON s.employee_id=e.id
     WHERE (e.termination_date IS NULL OR e.termination_date='' OR e.termination_date>=date('now','+9 hours'))
       AND (s.probation_end_date IS NOT NULL OR s.contract_end_date IS NOT NULL)
     ORDER BY e.name COLLATE NOCASE`).all()).results||[];
  const now=new Date(Date.now()+9*3600*1000).toISOString().slice(0,10);
  const upper=new Date(`${now}T00:00:00Z`);upper.setUTCDate(upper.getUTCDate()+30);const until=upper.toISOString().slice(0,10);
  const events=[];
  for(const r of results){
   for(const [kind,field] of [['probation','probation_end_date'],['contract','contract_end_date']]){
    const due=r[field];if(due&&due>=now&&due<=until)events.push({employee_id:r.id,name:r.name,employee_no:r.employee_no||'',department:r.department||'',workplace:r.workplace||'',type:kind,due_date:due});
   }
  }
  events.sort((a,b)=>a.due_date.localeCompare(b.due_date)||a.name.localeCompare(b.name,'ko'));
  return new Response(JSON.stringify({as_of:now,days:30,probation_count:events.filter(x=>x.type==='probation').length,contract_count:events.filter(x=>x.type==='contract').length,events}),{headers:{'Content-Type':'application/json; charset=utf-8',...headers}});
 }catch(e){return fail(e);}
}
export async function onRequestPost({request,env}){
 try{
  await authenticate(request,env);
  if(request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'허용되지 않은 요청입니다.'},403);
  if(!(request.headers.get('Content-Type')||'').includes('application/json'))return json({error:'JSON만 허용합니다.'},415);
  const body=await request.json();const id=Number(body.employee_id);
  if(!Number.isSafeInteger(id)||id<1)return json({error:'직원 번호를 확인해 주세요.'},400);
  const probation=String(body.probation_end_date||'').trim();const contract=String(body.contract_end_date||'').trim();
  if(!validDate(probation)||!validDate(contract))return json({error:'날짜를 올바르게 입력해 주세요.'},400);
  const emp=await env.DB.prepare('SELECT id FROM employees WHERE id=?').bind(id).first();
  if(!emp)return json({error:'직원을 찾을 수 없습니다.'},404);
  await env.DB.prepare(`INSERT INTO employee_hr_schedule(employee_id,probation_end_date,contract_end_date,updated_at)
   VALUES(?,?,?,CURRENT_TIMESTAMP)
   ON CONFLICT(employee_id) DO UPDATE SET probation_end_date=excluded.probation_end_date,contract_end_date=excluded.contract_end_date,updated_at=CURRENT_TIMESTAMP`).bind(id,probation||null,contract||null).run();
  return json({ok:true});
 }catch(e){return fail(e);}
}
