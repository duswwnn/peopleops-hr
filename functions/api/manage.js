import {authenticate,fail,json} from '../_lib/auth.js';
const str=(v,n=180)=>String(v??'').trim().slice(0,n);
const validDate=v=>!v||/^\d{4}-\d{2}-\d{2}$/.test(v);
const fieldNames=['employee_no','name','department','job_title','workplace','hire_date','termination_date'];
const safe=(x,max=200)=>str(x,max);
function validate(e){
 if(!e||typeof e!=='object'||Array.isArray(e)||!safe(e.name,100))throw new Response('직원 이름이 필요합니다.',{status:400});
 if(e.workplace && !['오산본사','과천지사'].includes(e.workplace))throw new Response('사업장은 오산본사 또는 과천지사를 선택해 주세요.',{status:400});
 if(!validDate(e.hire_date)||!validDate(e.termination_date))throw new Response('날짜는 YYYY-MM-DD 형식이어야 합니다.',{status:400});
 for(const k of ['certificates','grades','licenses','industries'])if(e[k]!==undefined&&!Array.isArray(e[k]))throw new Response('자격증·등급·면허 정보가 올바르지 않습니다.',{status:400});
 for(const k of ['certificates','grades','licenses','industries'])if((e[k]||[]).length>30)throw new Response('한 직원의 상세정보는 항목별 30건까지만 허용됩니다.',{status:400});
}
async function saveOne(db,entry,mode){
 validate(entry);const e=Object.fromEntries(fieldNames.map(k=>[k,safe(entry[k],k==='name'?100:180)]));
 const id=Number(entry.id)||0;let found=null;
 if(id)found=await db.prepare('SELECT id FROM employees WHERE id=?').bind(id).first();
 else if(e.employee_no)found=await db.prepare('SELECT id FROM employees WHERE employee_no=?').bind(e.employee_no).first();
 else {const matched=(await db.prepare('SELECT id FROM employees WHERE name=? AND COALESCE(department,\'\')=? LIMIT 2').bind(e.name,e.department).all()).results||[];if(matched.length>1)throw new Response('동명이인 가능성이 있습니다. 사번을 입력하세요.',{status:409});found=matched[0]||null;}
 if(found&&mode==='skip')return {status:'skipped',id:found.id};
 if(found&&mode==='create')throw new Response('이미 등록된 직원입니다. 수정 기능을 이용하세요.',{status:409});
 if(!found&&mode==='update')throw new Response('수정할 직원을 찾을 수 없습니다.',{status:404});
 const statements=[];let targetId=found?.id;
 if(found){statements.push(db.prepare('UPDATE employees SET employee_no=?,name=?,department=?,job_title=?,workplace=?,hire_date=?,termination_date=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(e.employee_no||null,e.name,e.department,e.job_title,e.workplace,e.hire_date||null,e.termination_date||null,targetId));}
 else {
  // D1 last_insert_rowid cannot be shared across separate batch statements safely. Allocate a new unique key first.
  const r=await db.prepare('SELECT COALESCE(MAX(id),0)+1 AS next_id FROM employees').first();targetId=r.next_id;
  statements.push(db.prepare('INSERT INTO employees(id,employee_no,name,department,job_title,workplace,hire_date,termination_date) VALUES(?,?,?,?,?,?,?,?)').bind(targetId,e.employee_no||null,e.name,e.department,e.job_title,e.workplace,e.hire_date||null,e.termination_date||null));
 }
 const detail=[['certificates','certificates',['certificate_name','certificate_level'],'certificate_name'],['grades','technical_grades',['technical_field','grade','specialty'],'technical_field'],['licenses','licenses',['license_type'],'license_type'],['industries','industry_registrations',['industry_name','registered_role'],'industry_name']];
 for(const [property,table,cols,required] of detail){
  if(!Object.prototype.hasOwnProperty.call(entry,property))continue;
  statements.push(db.prepare(`DELETE FROM ${table} WHERE employee_id=?`).bind(targetId));
  for(const item of entry[property]){
   const values=cols.map(c=>safe(item?.[c]));if(!safe(item?.[required]))continue;
   statements.push(db.prepare(`INSERT INTO ${table}(employee_id,${cols.join(',')}) VALUES(${Array(cols.length+1).fill('?').join(',')})`).bind(targetId,...values));
  }
 }
 statements.push(db.prepare('INSERT INTO audit_logs(actor_email,action,entity_type,entity_id,details) VALUES(?,?,?,?,?)').bind('shared-admin','upsert','employee',targetId,JSON.stringify({name:e.name,mode,detailKeys:detail.filter(d=>entry[d[0]]!==undefined).map(d=>d[0])})));
 await db.batch(statements);return {status:found?'updated':'created',id:targetId};
}

async function deleteEmployee(db, data){
 const id=Number(data.employee_id);
 if(!Number.isSafeInteger(id)||id<1)return json({error:'직원 번호가 올바르지 않습니다.'},400);
 const employee=await db.prepare('SELECT id,name,employee_no FROM employees WHERE id=?').bind(id).first();
 if(!employee)return json({error:'해당 직원이 존재하지 않습니다.'},404);
 if(!data.confirm_name||String(data.confirm_name).trim()!==String(employee.name).trim())return json({error:'삭제 확인을 위한 직원 이름이 일치하지 않습니다.'},400);
 // Delete dependent records first to satisfy foreign keys; transactionality provided by D1 batch.
 const statements=[
  db.prepare('DELETE FROM employee_hr_schedule WHERE employee_id=?').bind(id),
  db.prepare('DELETE FROM workplace_transfers WHERE employee_id=?').bind(id),
  db.prepare('DELETE FROM certificates WHERE employee_id=?').bind(id),
  db.prepare('DELETE FROM technical_grades WHERE employee_id=?').bind(id),
  db.prepare('DELETE FROM licenses WHERE employee_id=?').bind(id),
  db.prepare('DELETE FROM industry_registrations WHERE employee_id=?').bind(id),
  db.prepare('DELETE FROM employees WHERE id=? AND name=?').bind(id,employee.name),
  db.prepare('INSERT INTO audit_logs(actor_email,action,entity_type,entity_id,details) VALUES(?,?,?,?,?)').bind('shared-admin','delete','employee',id,JSON.stringify({name:employee.name,employee_no:employee.employee_no||'',reason:'등록 오류 정정'}))
 ];
 await db.batch(statements);
 return json({ok:true,deleted_id:id});
}

export async function onRequestPost({request,env}){
 try{
  await authenticate(request,env);
  if(request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'허용되지 않은 요청입니다.'},403);
  if(!(request.headers.get('Content-Type')||'').includes('application/json'))return json({error:'JSON만 허용합니다.'},415);
  if(Number(request.headers.get('Content-Length')||0)>180000)return json({error:'한 번에 보내는 데이터가 너무 큽니다.'},413);
  const data=await request.json();
  if(data.action==='delete')return await deleteEmployee(env.DB,data);
  if(data.action==='save')return json({ok:true,result:await saveOne(env.DB,data.employee,data.mode||'upsert')});
  if(data.action==='import'){
   if(!Array.isArray(data.rows)||data.rows.length<1||data.rows.length>10)return json({error:'한 번에 1~10명씩 등록할 수 있습니다.'},400);
   const output=[];
   for(let i=0;i<data.rows.length;i++){
    try{output.push({...await saveOne(env.DB,data.rows[i],data.mode||'skip'),row:i+1});}
    catch(e){output.push({status:'error',row:i+1,error:e instanceof Response?await e.text():'저장 실패'});}
   }
   return json({ok:true,results:output});
  }
  return json({error:'알 수 없는 요청입니다.'},400);
 }catch(e){return fail(e);}
}
