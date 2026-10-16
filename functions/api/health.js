// Public health check intentionally reveals no data.
export async function onRequestGet({env}) {return Response.json({ok:!!env.DB,message:env.DB?'D1 바인딩 확인':'D1 바인딩 없음'},{headers:{'Cache-Control':'no-store'}});}
