// Shared-password session authentication for Cloudflare Pages Functions.
const encoder = new TextEncoder();
const bytes = s => encoder.encode(s);
const b64url = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64 = s => Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)), x=>x.charCodeAt(0));
const equal = (a,b) => { if(a.length!==b.length)return false;let z=0;for(let i=0;i<a.length;i++)z|=a[i]^b[i];return z===0; };
async function hmacKey(env){if(!env.SESSION_SECRET||env.SESSION_SECRET.length<32)throw new Response('서버 세션 설정이 필요합니다.',{status:503});return crypto.subtle.importKey('raw',bytes(env.SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
export async function sign(env,msg){return b64url(await crypto.subtle.sign('HMAC',await hmacKey(env),bytes(msg)));}
export async function verifyPassword(env,pwd){
 const expected=env.ADMIN_PASSWORD;
 if(typeof expected!=='string'||expected.length<16)throw new Response('관리자 비밀번호 설정이 필요합니다.',{status:503});
 // Fixed-length SHA-256 digest comparison. Secret is never delivered to the browser.
 const digest=async text=>new Uint8Array(await crypto.subtle.digest('SHA-256',bytes(text)));
 return equal(await digest(pwd),await digest(expected));
}
export function cookieHeader(value,maxAge=28800){return `po_session=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;}
export async function createSession(env){const now=Math.floor(Date.now()/1000);const payload=b64url(bytes(JSON.stringify({iat:now,exp:now+28800,v:env.SESSION_VERSION||'1',n:b64url(crypto.getRandomValues(new Uint8Array(16)))})));return `${payload}.${await sign(env,payload)}`;}
export async function authenticate(request,env){
 if(!env.DB)throw new Response('D1 연결이 없습니다.',{status:503});
 const raw=(request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).find(x=>x.startsWith('po_session='));
 if(!raw)throw new Response('로그인이 필요합니다.',{status:401});
 const token=raw.slice('po_session='.length);const dot=token.lastIndexOf('.');if(dot<0)throw new Response('세션이 올바르지 않습니다.',{status:401});
 const msg=token.slice(0,dot),sig=token.slice(dot+1);let obj;
 try{if(!equal(unb64(sig),unb64(await sign(env,msg))))throw Error('signature');obj=JSON.parse(new TextDecoder().decode(unb64(msg)));}catch{throw new Response('세션이 올바르지 않습니다.',{status:401});}
 const now=Math.floor(Date.now()/1000);
 if(!obj.exp||obj.exp<=now||obj.iat>now+30||obj.exp-obj.iat>28800||obj.v!==(env.SESSION_VERSION||'1'))throw new Response('세션이 만료되었습니다. 다시 로그인하세요.',{status:401});
 return {id:0,email:null,display_name:'관리자',role:'viewer',active:1};
}
export function fail(e){const r=e instanceof Response?e:new Response('서버 처리 중 오류가 발생했습니다.',{status:500});return new Response(r.body,{status:r.status,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
export function json(data,status=200,headers={}){return Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});}
