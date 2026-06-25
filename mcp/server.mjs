#!/usr/bin/env node
// mcp/server.mjs — 멜라누아 MCP 서버.
//   로컬: stdio (claude_desktop_config.json 등록, 테스트용)  ·  원격: Streamable HTTP (Settings→Connectors)
// 키(SUPABASE_SERVICE_KEY 등)는 이 서버의 .env.local/환경에만 — 클라 머신 아님(보안).
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as T from './tools.mjs';

const txt = o => ({ content: [{ type: 'text', text: JSON.stringify(o, null, 2) }] });

export function buildServer() {
  const s = new McpServer({ name: 'melanoir-studio', version: '1.0.0' });
  s.tool('melanoir_status', '캠페인/드래프트 현황(콘솔과 동일 데이터)', {}, async () => txt(await T.status()));
  s.tool('melanoir_topic_next', '다음 발행 토픽(큐 자동 선택)', {}, async () => txt(await T.topicNext()));
  s.tool('melanoir_finalize', '캐러셀 스펙 → 이미지배정·캡션·브랜드/광고법 가드. spec(JSON slides)을 전달하면 final+가드결과 반환.',
    { spec: z.any() }, async ({ spec }) => txt(T.finalize(spec)));
  s.tool('melanoir_guard_channels', '채널 카피(linkedin/threads/naver-blog) 가드. channels(JSON), topicId 전달.',
    { channels: z.any(), topicId: z.union([z.string(), z.number()]) }, async ({ channels, topicId }) => txt(T.guardChannels(channels, topicId)));
  s.tool('melanoir_push', '발행: final(JSON)·channels(JSON|생략)·slug → Supabase 콘솔로 push(서버 키 사용).',
    { final: z.any(), channels: z.any().optional(), slug: z.string() }, async ({ final, channels, slug }) => txt(T.push(final, channels ?? null, slug)));
  return s;
}

// stdio 실행(직접 호출 시). 원격 HTTP 는 mcp/README.md 참고.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  buildServer().connect(new StdioServerTransport()).catch(e => { console.error(e); process.exit(1); });
}
