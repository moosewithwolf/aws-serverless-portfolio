# V2 Local AI Chatbot Harness — Design Skill Invocation Prompt

아래 research 아티팩트를 참조하여 `/skill:design`를 호출하세요.
이미Slice 1~3 코드 생성이 완료되었으나, 컨텍스트 윈도우 용량 문제로 새 세션에서 시작합니다.

## 참고 문서
- Research artifact: `.rpiv/artifacts/research/2026-05-24_19-13-45_v2-local-ai-chatbot-harness.md`
- Design artifact: `.rpiv/artifacts/designs/2026-05-24_19-59-24_v2-local-ai-chatbot-harness.md` (Skeleton + Slice 1~3 코드 포함)

## 이미 결정된 Architectural Decisions (Re-confirm)
1. **Separate Lambda**: `LocalAiFunction` (× 기존 `app.py` 확장) — `CodeUri: local_ai/harness/`
2. **Inline Component**: `AiChatView`를 `App.tsx`에 인라인 정의 (기존 패턴 준수)
3. **Dedicated chatApi.ts**: POST + polling async generator. `apiBaseUrl`는 `api.ts`에서 `export const`로 export
4. **Top-level `local_ai/`**: `backend/` 형제 패키지. 별도 `requirements.txt`
5. **sanitized: bool**: `ChatResponse`에 포함 (감사용)
6. **snake_case→camelCase**: Lambda handler에서 직렬화 시 변환
7. **Lambda Timeout**: 30초 (글로벌 3초 override)
8. **Polling Interval**: 2초
9. **Context Files**: 명시적 정렬 목록 (`profile.md`, `projects.md`, `resume.md`), `lru_cache`
10. **Safety**: Regex 기반 input/output/context 검증

## 이미 생성된 슬라이스 코드 (아티팩트 Architecture 섹션에 기록됨)
- **Slice 1** (Contracts & API Client): `contracts.py` + `chatApi.ts` — 완료
- **Slice 2** (Harness Core): `mock_backend.py`, `safety.py`, `prompt_builder.py`, `__init__.py`, `requirements.txt` — 완료
- **Slice 3** (Lambda Handler): `app.py` + `test_handler.py` — 완료

## 아직 미생성 슬라이스
- **Slice 4** (SAM Infrastructure): `backend/template.yaml` 수정 — LocalAiFunction 리소스, POST/OPTIONS/GET 라우트, Timeout 30초 override, CORS GET,POST,OPTIONS
- **Slice 5** (Frontend Chat Component): `App.tsx` (View enum, NavButton, AiChatView), `App.test.tsx` (chat tab test), `styles.css` (chat styles) — `chatApi.ts`는 Slice 1에서 이미 생성되었으나 Slice 5에서 타입 임포트 사용

## 기술적 제약사항
- Frontend: React single-state `activeView` enum. 모든 view가 `App.tsx` 인라인. CSS 모듈 없음. vitest + jsdom.
- Backend: SAM Lambda. `pyproject.toml` 없음. `requirements.txt`별도 관리. `conftest.py` 없음 — 테스트 피겨먼트 인라인.
- Lambda envelope: `{statusCode, headers, body: json.dumps(...)}`. API Gateway dual-format event parsing.

## 진행 시 제외할 것
- Docker container model client (Phase 2 deferred)
- Rate limiting (Phase 5 deferred)
- DynamoDB persistence (Phase 4 deferred)
- CI/CD pipeline (Phase 5 deferred)

---
[이 프롬프트를 새 세션에서 /skill:design에 붙여넣으세요]
