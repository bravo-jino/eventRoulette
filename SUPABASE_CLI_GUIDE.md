# Supabase CLI 쉬운 가이드

이 문서는 Windows PowerShell 기준으로 Supabase CLI를 설치하고, 프로젝트를 연결하고, Edge Functions와 Secrets를 배포하는 기본 흐름을 정리한 가이드입니다.

## 1. Supabase CLI 설치

먼저 Supabase CLI가 설치되어 있는지 확인합니다.

```powershell
supabase --version
```

명령어를 찾을 수 없다고 나오면 Scoop으로 설치합니다.

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex

scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

설치 후 다시 확인합니다.

```powershell
supabase --version
```

## 2. Supabase 로그인

```powershell
supabase login
```

브라우저가 열리면 Supabase 계정으로 로그인합니다.

## 3. 프로젝트 폴더로 이동

Supabase를 연결할 프로젝트 폴더로 이동합니다.

```powershell
cd C:\path\to\your-project
```

예시:

```powershell
cd C:\Users\YourName\Documents\Web\MyProject
```

## 4. Supabase 프로젝트 연결

Supabase 프로젝트 URL이 아래와 같다면:

```text
https://abcdefghijklmno.supabase.co
```

Project ref는 이 부분입니다.

```text
abcdefghijklmno
```

프로젝트를 연결합니다.

```powershell
supabase link --project-ref abcdefghijklmno
```

연결하면 로컬 프로젝트와 Supabase 프로젝트가 이어집니다.

## 5. Secrets 설정

Secrets는 GitHub에 올리면 안 되는 비밀값입니다.

예를 들어 API 키, 관리자 코드, service role key 같은 값은 코드에 직접 넣지 말고 Supabase secrets에 넣습니다.

```powershell
supabase secrets set MY_SECRET_NAME="my-secret-value"
```

여러 개를 설정할 수 있습니다.

```powershell
supabase secrets set ADMIN_CODE="1234"
supabase secrets set TOKEN_SECRET="long-random-string"
supabase secrets set SERVICE_ROLE_KEY="service-role-key"
```

설정된 secrets를 확인합니다.

```powershell
supabase secrets list
```

주의:

- secret 값은 GitHub에 커밋하지 않습니다.
- `service_role` 키는 절대 프론트엔드 코드에 넣지 않습니다.
- Supabase CLI는 `SUPABASE_`로 시작하는 secret 이름을 거부할 수 있으니, 직접 만든 이름을 사용합니다.

좋은 이름 예시:

```text
APP_SERVICE_ROLE_KEY
MYAPP_ADMIN_CODE
MYAPP_TOKEN_SECRET
```

피하는 이름 예시:

```text
SUPABASE_SERVICE_ROLE_KEY
```

## 6. Edge Function 만들기

Supabase Edge Function은 서버에서 실행되는 함수입니다.

예시 구조:

```text
supabase/
  functions/
    hello-world/
      index.ts
```

간단한 함수 예시:

```ts
Deno.serve(async (req) => {
  return new Response(JSON.stringify({ message: "Hello Supabase" }), {
    headers: { "Content-Type": "application/json" }
  });
});
```

## 7. Edge Function 배포

함수 이름이 `hello-world`라면:

```powershell
supabase functions deploy hello-world
```

여러 함수가 있으면 각각 배포합니다.

```powershell
supabase functions deploy function-a
supabase functions deploy function-b
```

함수 목록 확인:

```powershell
supabase functions list
```

## 8. Edge Function에서 Secret 사용

Edge Function 안에서는 이렇게 secret을 읽습니다.

```ts
const secret = Deno.env.get("MY_SECRET_NAME");
```

예시:

```ts
const serviceRoleKey = Deno.env.get("APP_SERVICE_ROLE_KEY");
```

## 9. 함수 수정 후 다시 배포

Edge Function 코드를 수정했다면 다시 배포해야 합니다.

```powershell
supabase functions deploy 함수이름
```

예시:

```powershell
supabase functions deploy hello-world
```

프론트엔드 파일만 수정했다면 Supabase 함수 재배포는 필요 없습니다.

## 10. 로그 확인

함수가 제대로 동작하지 않을 때 로그를 확인합니다.

```powershell
supabase functions logs 함수이름
```

예시:

```powershell
supabase functions logs hello-world
```

## 11. 자주 쓰는 명령어 요약

```powershell
supabase --version
supabase login
supabase link --project-ref 프로젝트ID
supabase secrets set KEY="value"
supabase secrets list
supabase functions deploy 함수이름
supabase functions list
supabase functions logs 함수이름
```

## 12. 일반적인 작업 순서

새 프로젝트에서 Supabase CLI를 쓸 때는 보통 이 순서로 진행합니다.

```powershell
cd C:\path\to\your-project
supabase login
supabase link --project-ref 프로젝트ID
supabase secrets set 필요한_SECRET="값"
supabase functions deploy 함수이름
```

## 13. 보안 체크리스트

- `anon key`는 프론트엔드에 공개될 수 있습니다.
- `service_role key`는 절대 프론트엔드나 GitHub public 저장소에 넣지 않습니다.
- 중요한 DB 작업은 Edge Function 뒤로 숨깁니다.
- Edge Function에서는 필요한 secret을 `Deno.env.get()`으로 읽습니다.
- RLS 정책은 최소 권한으로 설정합니다.
- 사용자가 직접 호출해도 되는 API와 관리자만 호출해야 하는 API를 분리합니다.

## 14. 문제 해결

### `supabase` 명령어를 찾을 수 없음

Supabase CLI가 설치되지 않았거나 PATH에 잡히지 않은 상태입니다.

```powershell
scoop install supabase
```

설치 후 PowerShell을 새로 열고 다시 시도합니다.

### `Env name cannot start with SUPABASE_`

secret 이름이 `SUPABASE_`로 시작해서 거부된 것입니다.

나쁜 예:

```powershell
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="..."
```

좋은 예:

```powershell
supabase secrets set APP_SERVICE_ROLE_KEY="..."
```

### 함수 수정했는데 반영이 안 됨

함수를 다시 배포해야 합니다.

```powershell
supabase functions deploy 함수이름
```

### 프론트엔드에서는 되는데 DB 작업이 실패함

확인할 것:

- Edge Function이 배포되었는지
- 필요한 secrets가 설정되었는지
- RLS 정책이 너무 막혀 있지 않은지
- `service_role key`를 함수에서 제대로 읽고 있는지
- 브라우저 콘솔 또는 함수 로그에 오류가 있는지

```powershell
supabase functions logs 함수이름
```
