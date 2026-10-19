# PeopleOps — GitHub Pages + Supabase 무료 배포판

이 버전은 **기존 Flask + SQLite 버전을 GitHub Pages에 업로드하는 것이 아닙니다.** GitHub Pages에는 Python 서버와 SQLite 파일이 실행되지 않으므로 **Supabase Auth + PostgreSQL + RLS** 구조로 바꾼 독립 버전입니다.

## 주의: 실직원 개인정보를 넣기 전에

- **이 ZIP에는 원본 인사 엑셀과 실제 직원명부를 포함하지 않았습니다.** GitHub Free Pages용 저장소는 반드시 공개여야 합니다. 직원 이름/자료/자격증 사진/비밀번호를 GitHub에 올리지 마세요.
- GitHub Pages는 공용 공개 웹 주소입니다. 로그인 뒤 데이터를 표시하도록 설계했지만, **정식 개인정보 보안 감사, 개인정보 처리위탁 검토, 회사 승인 및 백업 검증 전까지는 테스트용 가상 데이터만 사용**하세요.
- 데이터는 Supabase 클라우드에 저장됩니다. 회사의 외부 데이터 처리 승인/위탁 계약, 리전, 보존기한, 개인정보 처리방침 확인이 필요합니다. 무료 프로젝트는 중지될 수 있으므로 장기 안정적 운영을 보장하지 않습니다.
- 직원 삭제는 관련 자격증/기술인력 정보도 삭제합니다. 업무상 기록 보존 정책을 먼저 결정하세요.
- 현재는 단순 역할 기반 RBAC와 감사 로그를 제공하는 **MVP**입니다. 2단계 인증 의무화, 로그인 시도 제한, 오류 모니터링, 데이터 복구 검증, 사용자 초대 자동화, 상세 개인정보 권한 분리 등이 추가되기 전까지 운영용으로 확정하지 마세요.

## 1. Supabase 계정 및 데이터베이스

1. https://supabase.com 에 회원가입 → **New project** → Free 프로젝트 생성.
2. 프로젝트 → **SQL Editor** → `schema.sql`의 전체 내용을 붙여 넣고 실행. 이 스크립트는 **빈 새 프로젝트 전용**입니다.
3. **Authentication → Providers → Email**에서 이메일 로그인을 켜고, **공개 회원가입(Allow new users to sign up)을 꺼두세요**. 셀프 회원가입 대신 인증 관리자만 계정을 생성합니다.
4. **Authentication → Users**에서 인사 관리자 계정을 1개 생성하세요. 사용자 ID(UUID)를 복사합니다. Auth의 Invite user로 초대할 수도 있습니다. 초대 이메일 기능이 실제 작동하는지 확인하세요.
5. **SQL Editor**에서 다음 SQL의 UUID를 교체하고 실행해 관리자 승인:

```sql
update public.profiles
set role = 'admin', enabled = true
where id = '관리자-UUID-붙여넣기';
```

6. **Project Settings / Connect / API Keys**에서 **Project URL**과 브라우저용 **publishable key**(또는 구형 `anon` 키)를 복사. **secret/service_role 키는 절대 사용하지 마세요.**
7. `config.js`의 두 값을 변경하세요. 브라우저용 공개 키 자체는 비밀이 아니며, 데이터 보안은 `schema.sql`의 RLS 정책으로 보장합니다. 키를 넣기 전 RLS 설정 성공 여부를 확인하세요.

## 2. GitHub 무료 호스팅 (GitHub Pages)

1. https://github.com/new → Repository name: `peopleops-hr` → Public → Create repository.
2. 저장소 → **Add file → Upload files** → `index.html`, `style.css`, `app.js`, `config.js`를 업로드 (※ `schema.sql`/README는 필요 시 업로드 가능하지만 실제 직원 자료는 금지).
3. Commit changes.
4. **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)` → Save**.
5. 배포 후 `https://내깃허브아이디.github.io/peopleops-hr/` 로 접속. 사이트 주소에 직원 정보가 직접 포함되지 않습니다.
6. 인사팀 구성원은 이 주소에서 본인의 이메일/비밀번호로 로그인합니다. 비승인 계정은 로그인하더라도 개인정보를 조회할 수 없습니다.

## 3. 계정 추가와 권한

1. Supabase 관리자 콘솔 **Authentication → Users**에서 계정 생성 또는 Invite.
2. 자동 생성된 `profiles` 기록은 `viewer`, `enabled=false`가 기본입니다.
3. 사이트의 **사용자 관리**에서 admin이 다른 사용자 역할(`admin`/`editor`/`viewer`)과 사용 허용을 설정.
4. 현재 로그인한 관리자는 본인의 권한을 웹에서 변경할 수 없습니다.

| 권한 | 조회/CSV | 직원 등록·수정 | 직원 삭제 | 자격증·기술인력 수정 | 계정 권한/활성화 | 이력 열람 |
|---|---|---|---|---|---|---|
| admin | O | O | O | O | O | O |
| editor | O | O | X | O | X | X |
| viewer | O | X | X | X | X | X |

**최고 관리자라도 로그인 계정 생성은 Supabase 콘솔에서 수행합니다.** 브라우저에서 관리자용 API 키를 사용할 수 없기 때문입니다.

## 4. 제공 화면

- 종합 대시보드: 재직인원/직원등록건수/자격증/기술인력 데이터, 부서별 인원
- 월별 인원: 선택 월 입·퇴사 명단, 월말 인원 및 12개월 인원 추이
- 직원명부: 직원 등록·수정·퇴사일 입력·관리자 삭제, 검색
- 자격증: 직원별 다건 관리, 자격증 등급/분야/취득/만료일
- 기술인력: 분야/기술등급/업종/보유 면허/등록상태 다건 관리
- CSV: 인증된 사용자 대상 직원명부 내려받기
- 변경이력: 관리자 대상 최근 200건 작업 이력 (누가, 언제, 무엇을; 이전 값/신규 값 미보관)
- 사용자 관리: 승인된 관리자가 다른 계정의 권한/활성 상태 수정

**초기에는 모든 직원 자료가 비어 있습니다.** 회사 실제 엑셀을 GitHub에 업로드하지 마세요. 이 버전에는 보안 검토 전까지 원본 엑셀 일괄 업로드 기능을 일부러 넣지 않았습니다.

## 5. 테스트 체크리스트

- [ ] SQL 오류 없이 실행 및 RLS 켜짐 확인
- [ ] Supabase에서 Email 공개 회원가입 차단
- [ ] 첫 관리자 계정 활성화 → 웹 로그인 성공
- [ ] 비활성 계정 로그인 시 데이터 표시되지 않음
- [ ] viewer는 CRUD 불가, editor는 직원 삭제 불가, admin만 삭제 가능
- [ ] 가상 직원 2명 등록 → 입사/퇴사 집계 확인
- [ ] 자격증과 면허 다건 등록/삭제/조회
- [ ] 다른 브라우저에서 공용 기록 확인
- [ ] CSV 다운로드 내용 확인
- [ ] 변경이력에 작업 이력 남는지 확인
- [ ] 계정 접근 중지 후 다시 로드했을 때 조회 불가 확인
- [ ] 정식 사용 전 회사 보안·개인정보 처리 검토, 백업/복원 시험

## 6. 파일 설명

`index.html`: 화면 구조 / `style.css`: 디자인 / `app.js`: 기능 / `config.js`: Supabase URL 및 공개 키 / `schema.sql`: DB 테이블·권한·감사로그 / `README.md`: 본 설치 안내.

## 7. 무료 서비스 한계

GitHub Pages는 정적 파일만 실행합니다. Supabase 무료 프로젝트의 제한과 일시중지 정책은 https://supabase.com/pricing 에서 확인하세요. 비용과 서비스 정책은 변경될 수 있습니다.


로그인 비밀번호 설정 업데이트
