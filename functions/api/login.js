import {verifyPassword,createSession,cookieHeader,json,fail,sign} from '../_lib/auth.js';
export async function onRequestPost({request,env}) {try{
 if(!env.DB)throw new Response('D1 연결이 없습니다.',{status:503});
 const contentType=request.headers.get('Content-Type')||'';
 if(!contentType.includes('application/json'))return json({error:'JSON 요청만 허용합니다.'},415);
 const origin=request.headers.get('Origin');if(!origin||origin!==new URL(request.url).origin)return json({error:'허용되지 않은 요청입니다.'},403);
 const size=Number(request.headers.get('Content-Length')||0);if(size>4096)return json({error:'요청이 너무 큽니다.'},413);
 let data;try{data=await request.json();}catch{return json({error:'잘못된 요청입니다.'},400);}
 const pwd=typeof data?.password==='string'?data.password:'';
 const username=typeof data?.username==='string'?data.username:'';
 const expectedUsername=env.ADMIN_USERNAME||'admin';
 if(pwd.length>256)return json({error:'비밀번호가 너무 깁니다.'},400);
 // Store only an HMAC of IP + bucket, never the original IP.
 const ip=request.headers.get('CF-Connecting-IP')||'unknown';const bucket=Math.floor(Date.now()/900000);
 const tag=await sign(env,`${ip}:${bucket}`);
 const row=await env.DB.prepare('SELECT failures FROM login_attempts WHERE bucket_key = ?').bind(tag).first();
 if((row?.failures||0)>=5)return json({error:'로그인 시도가 많습니다. 약 15분 후 다시 시도하세요.'},429);
 const passwordValid=await verifyPassword(env,pwd);
 const valid=(username===expectedUsername) && passwordValid;
 if(!valid){
  await env.DB.prepare('INSERT INTO login_attempts(bucket_key,failures,updated_at) VALUES (?,1,?) ON CONFLICT(bucket_key) DO UPDATE SET failures = failures + 1, updated_at = excluded.updated_at').bind(tag,Date.now()).run();
  return json({error:'아이디 또는 비밀번호가 올바르지 않습니다.'},401);
 }
 await env.DB.prepare('DELETE FROM login_attempts WHERE bucket_key = ?').bind(tag).run();
 const session=await createSession(env);
 return json({ok:true},200,{'Set-Cookie':cookieHeader(session)});
}catch(e){return fail(e);}}
