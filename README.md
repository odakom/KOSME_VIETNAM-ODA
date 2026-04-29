# ODAKOM ODA 평가용역 관리 시스템 MVP

중소벤처기업진흥공단 “베트남 온라인 수출 플랫폼 모델 전수 ODA사업 종료평가 용역” 수행관리를 위한 React + TypeScript + Tailwind CSS + Vite 기반 웹앱입니다.

## 실행

```powershell
.\pnpm.exe install
.\pnpm.exe run dev
```

기본 개발 서버는 `http://127.0.0.1:5173/` 입니다.

## 환경변수

프로젝트 루트의 `.env`에 다음 값을 설정합니다.

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
VITE_CLIENT_ACCESS_PASSWORD=발주처_접근_비밀번호
```

`VITE_SUPABASE_URL`과 `VITE_SUPABASE_ANON_KEY`가 있으면 Supabase를 기준 데이터 저장소로 사용합니다. localStorage는 Supabase 조회/저장 실패 또는 환경변수 미설정 시에만 fallback으로 사용합니다.

## Supabase 설정

1. Supabase 프로젝트를 생성합니다.
2. SQL Editor에서 `supabase/schema.sql`을 실행합니다.
3. Storage bucket `project-deliverables`가 생성되었는지 확인합니다.
4. 개발 단계에서는 `schema.sql`에 포함된 permissive Storage policy와 RLS 비활성 설정을 사용합니다.
5. 운영 전에는 반드시 RLS를 켜고 역할별 정책을 강화해야 합니다.

## Supabase 기준 데이터 흐름

현재 핵심 데이터는 다음 Supabase 리소스를 단일 원본으로 사용합니다.

- `tasks`: 과업 체크리스트, 일정관리, 대시보드, 간트차트의 단일 원본
- `task_deliverables`: 과업별 산출물과 산출물 관리의 단일 원본
- `comments`: 발주처 의견의 단일 원본
- `approvals`: 검토완료/승인 상태 저장 기반
- Storage bucket `project-deliverables`: 산출물 파일 원본 저장

Supabase 테이블이 비어 있으면 앱은 샘플 데이터를 자동으로 넣지 않고 빈 목록을 그대로 표시합니다. 과업, 산출물, 발주처 의견은 사용자가 새로 등록한 뒤 Supabase에 저장됩니다.

## 파일 업로드와 다운로드

파일 업로드 경로는 다음 형식입니다.

```text
tasks/{taskId}/{storedFileName}
```

원본 한글 파일명은 `originalFileName`으로 저장하고, Storage key에는 ASCII 기반 `storedFileName`만 사용합니다. 업로드 후 생성된 public URL은 `task_deliverables.file_url`에 저장되며, 다운로드는 이 `file_url`을 우선 사용합니다.

## 현재 정상 작동 확인 항목

- 과업 체크리스트 수정값은 Supabase `tasks`에 저장되며 새로고침 후 유지됩니다.
- 일정관리, 대시보드, 간트차트는 별도 일정 데이터가 아니라 `tasks`를 기준으로 렌더링합니다.
- 산출물 업로드는 `project-deliverables` Storage에 실제 파일을 저장하고 public URL을 생성합니다.
- 산출물 다운로드는 `file_url`을 우선 사용하고, 필요한 경우 `filePath` 기반 signed/public URL을 fallback으로 사용합니다.
- 산출물 관리와 과업 체크리스트는 `taskDeliverables` 배열을 같은 원본으로 사용합니다.
- 발주처 공개 산출물은 `isVisibleToClient === true`인 항목만 표시합니다.
- 발주처 의견은 `comments`에 저장되고 발주처 화면과 내부 의견관리 화면에 같이 표시됩니다.
- 발주처 의견은 발주처 화면에서 수정/삭제할 수 있고, 내부 의견관리 화면에도 즉시 반영됩니다.
- 핵심 데이터인 `tasks`, `task_deliverables`, `comments`는 Supabase가 비어 있어도 샘플 데이터로 덮어쓰거나 자동 seed하지 않습니다.
- 프로젝트 설정 화면에서 현재 데이터 소스, 마지막 저장 시간, 저장된 과업 수, 산출물 수, 의견 수를 확인할 수 있습니다.

## localStorage fallback 기준

- Supabase 환경변수가 없거나 Supabase 조회/저장에 실패할 때만 localStorage 데이터를 사용합니다.
- fallback key는 `odakom_tasks`, `odakom_task_deliverables`, `odakom_comments`입니다.
- Supabase가 정상 설정된 상태에서는 새로고침 시 Supabase 데이터를 다시 불러와 화면에 반영합니다.

## 이번 점검 결과

2026-04-28 기준으로 다음을 확인했습니다.

- Supabase 환경변수 설정 확인
- `tasks`, `task_deliverables`, `comments`, `approvals` 테이블 접근 정상
- `project-deliverables` Storage 진단 파일 업로드 정상
- Storage 진단 파일 다운로드 정상
- Storage 진단 파일 삭제 정상
- TypeScript 검사 통과
- Vite production build 통과
- 주요 라우트 `/client/comments`, `/comments`, `/dashboard`, `/deliverables`, `/settings` 응답 정상

## 남은 이슈와 운영 전 보강 사항

- 현재 발주처 접근은 임시 비밀번호 방식입니다. 운영 전 Supabase Auth와 role 기반 접근 제어로 전환해야 합니다.
- 개발 편의를 위해 RLS가 느슨하거나 비활성화되어 있습니다. 운영 전 `admin`, `researcher`, `client` 역할별 RLS 정책을 분리해야 합니다.
- localStorage fallback에서 대용량 파일은 브라우저 용량 제한을 받을 수 있습니다. 운영에서는 Supabase Storage 사용을 전제로 합니다.
- 앱 번들이 500KB를 약간 넘습니다. 운영 최적화 단계에서 라우트 단위 code splitting을 적용하는 것이 좋습니다.
- 일부 화면 문구는 MVP 단계의 관리용 UI 기준입니다. 최종 보고용/발주처 배포용 문구는 별도 검수하면 좋습니다.

## 2026-04-29 배포 전 보안/권한 업데이트

필수 환경변수:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
VITE_ADMIN_ACCESS_PASSWORD=관리자_접속_비밀번호
VITE_CLIENT_ACCESS_PASSWORD=발주처_접속_비밀번호
```

- `VITE_ADMIN_ACCESS_PASSWORD`가 없으면 `/login`에서 관리자 로그인을 허용하지 않습니다.
- `VITE_CLIENT_ACCESS_PASSWORD`가 없으면 `/client/*` 발주처 화면 접근을 허용하지 않습니다.
- `client-demo` 같은 기본 비밀번호는 제거되었습니다.
- 내부 관리자 URL(`/tasks`, `/deliverables`, `/comments`, `/schedule`, `/settings` 등)은 라우팅 단계에서 `/login` 뒤로 보호됩니다.
- `supabase/schema.sql`에는 `tasks`, `task_deliverables`, `comments`, `approvals` RLS 활성화 및 admin/client 역할별 policy가 포함되어 있습니다.
- 운영 RLS는 Supabase Auth JWT의 `app_metadata.role` 또는 `user_role` 값이 `admin`/`client`로 들어온다는 전제입니다.
- 현재 password gate는 프론트 라우팅 보호용입니다. anon key 직접 REST 접근까지 완전히 막으려면 Supabase Auth 또는 서버/Edge Function 기반 권한 부여를 함께 적용해야 합니다.

## 발주처 전용 배포 권장 설정

발주처에게 배포하는 Vercel Production 환경에서는 내부 관리자 화면을 같은 배포본에서 열지 않는 구성을 권장합니다.

```env
VITE_CLIENT_ONLY_DEPLOY=true
VITE_CLIENT_ACCESS_PASSWORD=발주처_접속_비밀번호
```

이 값이 `true`이면 `/tasks`, `/deliverables`, `/comments`, `/settings`, `/login` 등 내부 경로로 접근해도 `/client/dashboard`로 이동합니다.
내부관리자 작업은 로컬 개발 서버 또는 별도 관리자 배포 환경에서 수행하는 편이 안전합니다.

주의: `VITE_*` 값은 프론트엔드 번들에 포함됩니다. 비밀번호 gate는 시연/제한 공개용 접근 제어이며, DB 보안은 반드시 Supabase RLS/Auth로 보강해야 합니다.

## 발주처 전용 RLS 적용 방식

현재 `supabase/schema.sql`의 발주처용 정책은 다음을 허용합니다.

- `tasks`: `is_visible_to_client=true`인 과업 조회만 허용
- `task_deliverables`: `is_visible_to_client=true`인 산출물 조회만 허용
- `comments`: 발주처 의견 조회/작성/수정/삭제 허용
- `storage.objects`: `project-deliverables` 파일 조회만 허용

`tasks`와 `task_deliverables`의 anon insert/update/delete는 허용하지 않습니다. 따라서 발주처 전용 배포 환경에서는 DB 원본 과업/산출물 훼손 위험을 줄일 수 있습니다.

내부관리자가 운영 DB를 직접 수정해야 하는 관리자 배포본은 Supabase Auth role=`admin` 또는 별도 서버/Edge Function 권한 구조를 적용한 뒤 사용하세요.
