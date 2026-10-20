import {authenticate,fail,json} from '../_lib/auth.js';

export async function onRequestGet({request,env}){
 try{
  await authenticate(request,env);
  const year=Number(new URL(request.url).searchParams.get('year'));
  if(!Number.isInteger(year)||year<2000||year>2100)return json({error:'올바른 연도를 입력하세요.'},400);
  const {results=[]}=await env.DB.prepare(`
   WITH RECURSIVE months(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM months WHERE n<12),
   bounds AS (SELECT n, date(printf('%04d-%02d-01',?,n),'+1 month','-1 day') AS month_end FROM months),
   dated AS (
    SELECT b.n,e.id,
      COALESCE((SELECT t.from_workplace FROM workplace_transfers t
       WHERE t.employee_id=e.id AND t.effective_date>b.month_end
       ORDER BY t.effective_date ASC LIMIT 1),COALESCE(e.workplace,'')) AS site
    FROM bounds b JOIN employees e
      ON e.hire_date IS NOT NULL AND date(e.hire_date)<=b.month_end
      AND (e.termination_date IS NULL OR trim(e.termination_date)='' OR date(e.termination_date)>b.month_end)
   )
   SELECT m.n AS month,
    COALESCE(SUM(CASE WHEN d.site='오산본사' THEN 1 ELSE 0 END),0) AS osan,
    COALESCE(SUM(CASE WHEN d.site='과천지사' THEN 1 ELSE 0 END),0) AS gwacheon,
    COALESCE(SUM(CASE WHEN d.site NOT IN ('오산본사','과천지사') THEN 1 ELSE 0 END),0) AS unassigned
   FROM months m LEFT JOIN dated d ON d.n=m.n GROUP BY m.n ORDER BY m.n
  `).bind(year).all();
  return json({year,months:results.map(r=>({month:Number(r.month),osan:Number(r.osan)||0,gwacheon:Number(r.gwacheon)||0,unassigned:Number(r.unassigned)||0}))});
 }catch(e){return fail(e)}
}
