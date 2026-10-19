import {authenticate,fail,json} from '../_lib/auth.js';
export async function onRequestGet({request,env}){try{await authenticate(request,env);return json({error:'공용 비밀번호 모드에서는 개인정보 보호를 위해 사용자 계정 목록 조회를 제공하지 않습니다.'},403);}catch(e){return fail(e);}}
