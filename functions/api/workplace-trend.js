import {authenticate,fail,json} from '../_lib/auth.js';

export async function onRequestGet({request,env}) {
  try {
    await authenticate(request,env);
    const year = Number(new URL(request.url).searchParams.get('year'));
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return json({error:'올바른 조회 연도를 선택하세요.'},400);
    }
    const rows=await env.DB.prepare(`
      WITH RECURSIVE months(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM months WHERE n<12),
      bounds AS (SELECT n, date(printf('%04d-%02d-01', ?, n), '+1 month','-1 day') AS month_end FROM months)
      SELECT b.n AS month,
        SUM(CASE WHEN trim(COALESCE(e.workplace,''))='오산본사' THEN 1 ELSE 0 END) AS osan,
        SUM(CASE WHEN trim(COALESCE(e.workplace,''))='과천지사' THEN 1 ELSE 0 END) AS gwacheon,
        SUM(CASE WHEN trim(COALESCE(e.workplace,'')) NOT IN ('오산본사','과천지사') THEN 1 ELSE 0 END) AS unassigned
      FROM bounds b LEFT JOIN employees e
        ON e.hire_date IS NOT NULL AND date(e.hire_date)<=b.month_end
        AND (e.termination_date IS NULL OR trim(e.termination_date)='' OR date(e.termination_date)>b.month_end)
      GROUP BY b.n ORDER BY b.n
    `).bind(year).all();
    return json({year,months:(rows.results||[]).map(r=>({month:Number(r.month),osan:Number(r.osan)||0,gwacheon:Number(r.gwacheon)||0,unassigned:Number(r.unassigned)||0}))});
  } catch(e) {return fail(e);}
}
