import {authenticate,fail,json} from '../_lib/auth.js';

const allowed=['오산본사','과천지사'];
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00'))&&new Date(s+'T00:00:00').toISOString().slice(0,10)===s;

export async function onRequestGet({request,env}){
 try{
  await authenticate(request,env);
  const id=Number(new URL(request.url).searchParams.get('employee_id'));
  if(!Number.isSafeInteger(id)||id<1)return json({error:'직원을 선택하세요.'},400);
  const emp=await env.DB.prepare('SELECT id,name,workplace FROM employees WHERE id=?').bind(id).first();
  if(!emp)return json({error:'해당 직원이 없습니다.'},404);
  const data=await env.DB.prepare('SELECT id,effective_date,from_workplace,to_workplace,notes,created_at FROM workplace_transfers WHERE employee_id=? ORDER BY effective_date DESC,id DESC').bind(id).all();
  return json({employee:emp,rows:data.results||[]});
 }catch(e){return fail(e)}
}

export async function onRequestPost({request,env}){
 try{
  const actor=await authenticate(request,env);
  const body=await request.json();
  const id=Number(body.employee_id),date=String(body.effective_date||''),to=String(body.to_workplace||'').trim();
  const notes=String(body.notes||'').trim().slice(0,200);
  if(!Number.isSafeInteger(id)||id<1||!allowed.includes(to)||!validDate(date))return json({error:'직원·이동일·사업장을 정확하게 입력하세요.'},400);
  const today=new Date().toISOString().slice(0,10);
  if(date>today)return json({error:'미래 발령은 발령일이 도래한 뒤 등록해 주세요.'},400);
  const emp=await env.DB.prepare('SELECT id,name,workplace,hire_date,termination_date FROM employees WHERE id=?').bind(id).first();
  if(!emp)return json({error:'직원 정보가 없습니다.'},404);
  if(emp.hire_date&&date<emp.hire_date)return json({error:'입사일 이전에는 발령을 등록할 수 없습니다.'},400);
  if(emp.termination_date&&date>=emp.termination_date)return json({error:'퇴사일 이후 발령은 등록할 수 없습니다.'},400);
  const prev=String(emp.workplace||'').trim();
  if(prev===to)return json({error:'현재 사업장과 동일합니다. 다른 사업장을 선택하세요.'},400);
  const last=await env.DB.prepare('SELECT effective_date FROM workplace_transfers WHERE employee_id=? ORDER BY effective_date DESC LIMIT 1').bind(id).first();
  if(last&&date<=last.effective_date)return json({error:'기존 이동 이력 이후 날짜로만 추가할 수 있습니다.'},400);
  // D1 batch is transactionally executed: insertion and employee current location stay in sync.
  const operations=[
   env.DB.prepare('INSERT INTO workplace_transfers(employee_id,effective_date,from_workplace,to_workplace,notes) VALUES (?,?,?,?,?)').bind(id,date,prev,to,notes),
   env.DB.prepare('UPDATE employees SET workplace=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND COALESCE(workplace,'')=?').bind(to,id,prev)
  ];
  await env.DB.batch(operations);
  return json({ok:true,employee_id:id,from_workplace:prev,to_workplace:to,effective_date:date});
 }catch(e){return fail(e)}
}
