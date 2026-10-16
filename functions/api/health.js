
export async function onRequestGet({ env }) {
  if (!env.DB) {
    return Response.json(
      { ok: false, message: "D1 연결이 없습니다." },
      { status: 503 }
    );
  }

  return Response.json({
    ok: true,
    message: "PeopleOps 서버와 D1 연결 성공!"
  });
}
