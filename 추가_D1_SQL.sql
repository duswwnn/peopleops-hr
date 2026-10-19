-- Cloudflare D1 Console에 한번 실행합니다. 직원·자격증 데이터는 변경하지 않습니다.
CREATE TABLE IF NOT EXISTS login_attempts (
  bucket_key TEXT PRIMARY KEY,
  failures INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
