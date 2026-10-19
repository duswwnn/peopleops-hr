import {cookieHeader,json} from '../_lib/auth.js';
export async function onRequestPost({request}) {const origin=request.headers.get('Origin');if(!origin||origin!==new URL(request.url).origin)return json({error:'허용되지 않은 요청입니다.'},403);return json({ok:true},200,{'Set-Cookie':cookieHeader('',0)});}
