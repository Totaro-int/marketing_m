# 멜라누아 MCP 서버 (옵션 B — 키 서버사이드)

클라이언트 Claude Desktop이 **Settings → Customization → Connectors** 로 붙이는 커넥터. **`SUPABASE_SERVICE_KEY` 등 키는 이 서버에만** 두어, 클라 머신엔 키가 없습니다(보안).

**역할 분담:** 카피 작성 = 클라 Claude(구독) · 렌더(IG 카드) = 브라우저 카드 편집기 · **가드/마감/발행 = 이 MCP**(서버 키).

## 도구
| tool | 설명 |
|---|---|
| `melanoir_status` | 캠페인/드래프트 현황 |
| `melanoir_topic_next` | 다음 토픽(큐) |
| `melanoir_finalize` | 스펙 → 이미지배정·캡션·가드 (canvas 불필요) |
| `melanoir_guard_channels` | 채널 카피 가드 |
| `melanoir_push` | Supabase 콘솔로 발행(서버 키) |

## 설치 & 설정
```bash
cd mcp && npm install      # @modelcontextprotocol/sdk, zod
```
키: 상위 레포 루트 `.env.local`(엔진 `_lib`가 로드) 에 `SUPABASE_URL`·`SUPABASE_SERVICE_KEY` 등.

### A) 로컬 stdio (테스트 / 단일 PC)
`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):
```json
{ "mcpServers": { "melanoir": { "command": "node", "args": ["/ABS/PATH/melanoir-studio/mcp/server.mjs"] } } }
```
**절대경로** 필수. Claude Desktop 완전 재시작. (키가 그 PC에 있음 — 진짜 보안 분리는 B)

### B) 원격 HTTP (Settings → Connectors, 권장 — 키 서버 보관) — 다음 단계
1. `server.mjs`의 `buildServer()` 를 **Streamable HTTP 트랜스포트**로 감싼 엔드포인트(`/mcp`)로 노출
   (`@modelcontextprotocol/sdk/server/streamableHttp.js`).
2. 공개 호스트 배포(예: Vercel 함수 / 소형 VPS). 호스트 환경변수에 `SUPABASE_URL`·`SUPABASE_SERVICE_KEY`.
   - ⚠️ 엔진 모듈(`../engine`, `../scripts`)이 함께 배포돼야 함. push 도구는 `node scripts/push-*.mjs` 를 spawn → 호스트에 레포 필요.
3. 클라: **Settings → Customization → Connectors → 커스텀 추가 → `https://<host>/mcp`** (+ 필요시 인증).

> 현재: 도구 로직·stdio 서버 완성·검증. **원격 HTTP 엔드포인트 + 호스팅이 마지막 단계**(미완).
