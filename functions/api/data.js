import {authenticate,fail,json} from '../_lib/auth.js';
const tables={employees:'employees',certificates:'certificates',technical:'technical_grades',licenses:'licenses',industries:'industry_registrations'};
export async function onRequestGet({request,env}){try{
 const user=await authenticate(request,env);
 const url=new URL(request.url); const name=url.searchParams.get('table')||'employees';
 if(!Object.hasOwn(tables,name))return json({error:'잘못된 조회 종류입니다.'},400);
 const columns = name==='employees'?'e.*':'t.*, e.name AS employee_name, e.employee_no AS employee_no';
 const sql = name==='employees' ? 'SELECT e.* FROM employees e ORDER BY e.id DESC LIMIT 500' : `SELECT ${columns} FROM ${tables[name]} t JOIN employees e ON e.id=t.employee_id ORDER BY t.id DESC LIMIT 500`;
 const rows=await env.DB.prepare(sql).all();
 return json({user:{email:user.email,role:user.role},rows:rows.results||[]});
}catch(e){return fail(e);}}
