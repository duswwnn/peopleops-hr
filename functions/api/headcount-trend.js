import {authenticate,fail,json} from '../_lib/auth.js';

export async function onRequestGet({request,env}) {
  try {
    await authenticate(request,env);
    const url = new URL(request.url);
    const year = Number(url.searchParams.get('year'));
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return json({error:'올바른 조회 연도를 선택하세요.'},400);
    }
    const rows = await env.DB.prepare(`
      WITH RECURSIVE months(n) AS (
        SELECT 1 UNION ALL SELECT n+1 FROM months WHERE n < 12
      ), boundaries AS (
        SELECT n, printf('%04d-%02d-01', ?, n) AS start_date FROM months
      )
      SELECT n AS month,
        (SELECT COUNT(*) FROM employees e
         WHERE e.hire_date IS NOT NULL
           AND date(e.hire_date) <= date(b.start_date, '+1 month', '-1 day')
           AND (e.termination_date IS NULL OR trim(e.termination_date) = ''
                OR date(e.termination_date) >= date(b.start_date, '+1 month', '-1 day'))
        ) AS headcount,
        (SELECT COUNT(*) FROM employees e
         WHERE e.hire_date >= b.start_date
           AND e.hire_date < date(b.start_date, '+1 month')) AS hires,
        (SELECT COUNT(*) FROM employees e
         WHERE e.termination_date >= b.start_date
           AND e.termination_date < date(b.start_date, '+1 month')) AS leaves
      FROM boundaries b ORDER BY n
    `).bind(year).all();
    return json({year, months:(rows.results||[]).map(r=>({month:Number(r.month),headcount:Number(r.headcount)||0,hires:Number(r.hires)||0,leaves:Number(r.leaves)||0}))});
  } catch (e) { return fail(e); }
}
