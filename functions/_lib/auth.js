// Cloudflare Access JWT verification. Do not trust client-side login state or email headers.
const b64url = s => { const t=s.replace(/-/g,'+').replace(/_/g,'/'); return Uint8Array.from(atob(t+'='.repeat((4-t.length%4)%4)),c=>c.charCodeAt(0)); };
const decode = s => JSON.parse(new TextDecoder().decode(b64url(s)));
let cache = {url:'',data:null,expires:0};
export async function authenticate(request, env) {
  const team = (env.ACCESS_TEAM_DOMAIN || '').replace(/^https?:\/\//,'').replace(/\/$/,'');
  const aud = env.ACCESS_AUD;
  if (!team || !aud || !env.DB) throw new Response('서버 인증 설정이 완료되지 않았습니다.',{status:503});
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) throw new Response('Cloudflare Access 로그인이 필요합니다.',{status:401});
  const parts=token.split('.'); if(parts.length!==3) throw new Response('잘못된 토큰입니다.',{status:401});
  let h,p; try { h=decode(parts[0]);p=decode(parts[1]); }catch{throw new Response('잘못된 토큰입니다.',{status:401});}
  if (!['RS256','ES256'].includes(h.alg)||!h.kid) throw new Response('지원되지 않는 토큰입니다.',{status:401});
  const now=Math.floor(Date.now()/1000);
  if (p.iss !== `https://${team}` || !(Array.isArray(p.aud)?p.aud.includes(aud):p.aud===aud) || !p.exp || p.exp<=now || (p.nbf&&p.nbf>now+60)) throw new Response('만료되었거나 유효하지 않은 로그인입니다.',{status:401});
  const url=`https://${team}/cdn-cgi/access/certs`;
  if (!cache.data||cache.url!==url||cache.expires<Date.now()) {
    const res=await fetch(url);if(!res.ok)throw new Response('인증키 조회 실패',{status:503});
    const obj=await res.json();cache={url,data:obj.keys,expires:Date.now()+300000};
  }
  const jwk=cache.data.find(x=>x.kid===h.kid);
  if(!jwk)throw new Response('로그인 인증키가 유효하지 않습니다.',{status:401});
  const key=await crypto.subtle.importKey('jwk',jwk,h.alg==='RS256'?{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'}:{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
  const verified=await crypto.subtle.verify(h.alg==='RS256'?{name:'RSASSA-PKCS1-v1_5'}:{name:'ECDSA',hash:'SHA-256'},key,b64url(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1]));
  if(!verified)throw new Response('로그인 서명이 일치하지 않습니다.',{status:401});
  const email=String(p.email||'').trim().toLowerCase();
  if(!email)throw new Response('이메일 정보가 없습니다.',{status:403});
  const user=await env.DB.prepare('SELECT id,email,display_name,role,active FROM hr_users WHERE email = ? COLLATE NOCASE').bind(email).first();
  if(!user||user.active!==1)throw new Response('관리자 승인을 기다리는 계정입니다.',{status:403});
  return user;
}
export function fail(e){const response=e instanceof Response?e:new Response('서버 처리 중 오류가 발생했습니다.',{status:500});return new Response(response.body,{status:response.status,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
export function json(data,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
