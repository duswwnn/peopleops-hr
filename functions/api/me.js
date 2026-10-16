import {authenticate,fail,json} from '../_lib/auth.js';
export async function onRequestGet({request,env}){try{const user=await authenticate(request,env);return json({user});}catch(e){return fail(e);}}
