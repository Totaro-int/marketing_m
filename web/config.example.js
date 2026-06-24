// web-review 설정 — 이 파일을 config.js 로 복사하고 값을 채우세요.
//   cp config.example.js config.js
// config.js 는 .gitignore 대상 (커밋 금지).
//
// anon 키는 공개돼도 RLS(행 보안)로 보호됩니다. 단, "비공개 링크" 보안은
// 이 배포 URL 을 클라에게만 공유하는 데서 나옵니다. (검색 노출 차단은 vercel.json 의 noindex)
//
// 값 위치: Supabase 대시보드 → Project Settings → API
//   Project URL          → SB_URL
//   Project API keys → anon public → SB_ANON   (service_role 키는 절대 여기 넣지 말 것)

window.SB_URL  = 'https://YOUR-PROJECT.supabase.co';
window.SB_ANON = 'YOUR-ANON-PUBLIC-KEY';
