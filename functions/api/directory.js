import {authenticate,fail,json} from '../_lib/auth.js';
export async function onRequestGet({request,env}) {
  try {
    await authenticate(request,env);
    const rows=(await env.DB.prepare('SELECT id, employee_no, name, department, workplace, job_title, hire_date, termination_date FROM employees ORDER BY name COLLATE NOCASE, id LIMIT 1000').all()).results||[];
    const queries=[
      ['certificates','SELECT employee_id, certificate_name, certificate_level FROM certificates ORDER BY id LIMIT 10000'],
      ['grades','SELECT employee_id, technical_field, grade, specialty FROM technical_grades ORDER BY id LIMIT 10000'],
      ['licenses','SELECT employee_id, license_type FROM licenses ORDER BY id LIMIT 10000'],
      ['industries','SELECT employee_id, industry_name, registered_role FROM industry_registrations ORDER BY id LIMIT 10000']
    ];
    const byId=new Map(rows.map(r=>{r.certificates=[];r.grades=[];r.licenses=[];r.industries=[];return [r.id,r]}));
    for(const [key,sql] of queries){
      const data=(await env.DB.prepare(sql).all()).results||[];
      for(const item of data){const row=byId.get(item.employee_id);if(row)row[key].push(item);}
    }
    return json({rows});
  }catch(err){return fail(err);}
}
