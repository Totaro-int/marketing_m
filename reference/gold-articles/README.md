# gold-articles — 장문 골드 레퍼런스 (작가·기자 품질 절대 기준)

- `gold_<style>_<NN>.json` 형식의 도시어만 few-shot으로 주입된다 (story.mjs가 style 일치분 최대 2개).
- **골드 승격 = 사람의 결정**: 콘솔에서 승인·발행된 도시어 중 품질이 기준이 될 만한 것을 이 폴더에 `gold_` 접두어로 복사한다. 에이전트가 스스로 골드를 만들지 않는다.
- `candidate_*.json` = 승격 후보(주입 안 됨). 콜드 스타트: 첫 샘플들이 후보로 들어오며, Chief Architect 승인 후 rename.
