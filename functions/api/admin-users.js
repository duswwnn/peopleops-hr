import {authenticate,fail,json} from '../_lib/auth.js';
export async function onRequestGet({request,env}){try{const user=await authenticate(request,env);if(user.role!=='admin')return json({error:'관리자만 조회할 수 있습니다.'},403);const r=await env.DB.prepare('SELECT id,email,display_name,role,active FROM hr_users ORDER BY email LIMIT 200').all();return json({rows:r.results});}catch(e){return fail(e);}}
