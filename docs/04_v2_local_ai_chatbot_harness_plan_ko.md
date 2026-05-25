# 04_V2 로컬 AI 챗봇 하네스 구축 계획

## 목표

v2의 목표는 방문자가 포트폴리오에서 질문하면, AWS가 요청을 받고 로컬 MacBook의 `llama.cpp` 모델이 답하는 하이브리드 챗봇을 만드는 것이다.

가장 중요한 구현 원칙:

```text
처음부터 AWS/SQS/DynamoDB를 붙이지 않는다.
먼저 로컬에서 “진짜와 같은 입출력”이 나오는 하네스를 만든다.
그 다음 AWS 릴레이를 같은 인터페이스 뒤에 붙인다.
```

즉 v2는 다음 순서로 진행한다.

```text
1. 로컬 챗봇 하네스
2. 로컬 mock LLM
3. llama.cpp 연결
4. 프론트 채팅 UI
5. AWS SQS/DynamoDB 릴레이
6. 실제 방문자용 배포
```

## 최종 아키텍처

```text
Visitor browser
→ React Chat UI
→ API Gateway
→ Lambda
→ SQS job queue
→ MacBook local agent
→ llama.cpp local model
→ DynamoDB result table
→ React polling
```

MacBook에는 inbound port를 열지 않는다.

```text
나쁜 구조:
Internet → MacBook local port

좋은 구조:
MacBook agent → AWS SQS polling
```

## v2에서 새로 생길 API

### POST /chat

방문자 질문을 접수한다.

Request:

```json
{
  "message": "What AWS services does Shinseong use?"
}
```

Response:

```json
{
  "requestId": "chat_abc123",
  "status": "PENDING"
}
```

역할:

- 질문 길이 검증
- request id 생성
- 상태를 `PENDING`으로 저장
- job queue에 질문 넣기

### GET /chat/{requestId}

답변 상태를 조회한다.

Pending response:

```json
{
  "requestId": "chat_abc123",
  "status": "PENDING"
}
```

Done response:

```json
{
  "requestId": "chat_abc123",
  "status": "DONE",
  "answer": "Shinseong uses S3, CloudFront, Route 53, API Gateway, and Lambda in this portfolio."
}
```

Error response:

```json
{
  "requestId": "chat_abc123",
  "status": "ERROR",
  "message": "Local agent is unavailable."
}
```

## 로컬 하네스가 먼저 필요한 이유

AWS를 먼저 붙이면 디버깅 포인트가 너무 많아진다.

```text
React UI
API Gateway
Lambda
SQS
DynamoDB
local agent
llama.cpp
prompt
context
```

그래서 먼저 로컬에서 아래 흐름이 돌아가야 한다.

```text
test question
→ local harness
→ prompt builder
→ mock model or llama.cpp
→ answer JSON
```

하네스 성공 기준:

```text
같은 질문을 넣으면 프론트/API가 기대하는 JSON 형태로 답이 나온다.
mock model과 llama.cpp model을 바꿔 끼울 수 있다.
AWS 없이도 챗봇 전체 입출력을 테스트할 수 있다.
```

## 구현할 로컬 하네스 구조

추천 파일 구조:

```text
local_ai/
  context/
    profile.md
    projects.md
    resume.md
  prompts/
    system_prompt.md
  harness/
    chat_contract.py
    prompt_builder.py
    mock_model.py
    llama_cpp_client.py
    run_chat.py
  tests/
    test_prompt_builder.py
    test_chat_contract.py
    test_mock_chat.py
```

### context 파일

모델에게 줄 내 정보.

예:

```text
profile.md
projects.md
resume.md
```

여기에는 공개 가능한 정보만 넣는다.

넣을 내용:

- 이름
- 학교
- AWS 자격증
- 프로젝트 설명
- 기술 스택
- v1 포트폴리오 AWS 구조

넣지 말 것:

- access key
- account id
- secret
- 실제 AWS resource id
- 주소, 전화번호 등 민감정보

### system_prompt.md

모델 행동 규칙.

초안:

```text
You are Shinseong Kim's portfolio assistant.
Answer only with information provided in the context.
If the answer is not in the context, say you do not have that information.
Do not invent work history, credentials, project details, or private information.
Keep answers concise, friendly, and technically accurate.
```

### chat_contract.py

프론트/API/로컬 모델이 공유할 입출력 계약.

예상 타입:

```python
ChatRequest:
  request_id: str
  message: str

ChatResponse:
  request_id: str
  status: "DONE" | "ERROR"
  answer: str | None
  message: str | None
```

### prompt_builder.py

질문과 context를 합쳐 모델 prompt를 만든다.

역할:

- system prompt 읽기
- context markdown 읽기
- 사용자 질문 붙이기
- 토큰을 너무 많이 쓰지 않도록 context 순서 정리

### mock_model.py

처음에는 진짜 LLM 없이 deterministic 답변을 만든다.

이유:

```text
테스트가 안정적이어야 한다.
프론트 UI와 API contract를 먼저 검증해야 한다.
llama.cpp 성능/모델 문제와 UI 문제를 분리해야 한다.
```

예:

```text
질문에 "AWS"가 있으면 AWS 프로젝트 설명 답변
질문에 "certification"이 있으면 자격증 설명 답변
그 외에는 context에 정보가 없다고 답변
```

### llama_cpp_client.py

나중에 실제 `llama.cpp` server와 연결한다.

기본 전제:

```text
llama-server가 http://127.0.0.1:8080 에 떠 있음
OpenAI-compatible endpoint 또는 llama.cpp native endpoint 사용
```

환경변수:

```text
LLAMA_CPP_BASE_URL=http://127.0.0.1:8080
LOCAL_AI_BACKEND=mock | llama.cpp
```

### run_chat.py

터미널에서 로컬 챗봇을 테스트하는 CLI.

예:

```bash
python local_ai/harness/run_chat.py "What AWS services does this portfolio use?"
```

출력:

```json
{
  "requestId": "local_test",
  "status": "DONE",
  "answer": "This portfolio uses S3, CloudFront, Route 53, API Gateway, and Lambda."
}
```

## 프론트 UI 계획

현재 `AI Roadmap` 탭을 `Ask AI` 탭으로 확장한다.

처음 로컬 개발에서는 API 없이 mock 상태를 보여준다.

UI 상태:

```text
idle
typing
pending
done
error
local-agent-offline
```

UI 구성:

```text
질문 입력창
Ask 버튼
답변 bubble
status pill
예시 질문 3개
```

예시 질문:

```text
What AWS services does this portfolio use?
What projects has Shinseong built?
What certifications does Shinseong have?
```

중요:

```text
Home 화면에는 AI 설명을 많이 넣지 않는다.
AI 설명과 구조는 Ask AI 탭 안에서만 보여준다.
```

## 로컬 개발 순서

### Phase 1: 로컬 하네스

목표:

```text
AWS 없이 질문 → 답변 JSON 생성
```

작업:

```text
local_ai/context/*.md 작성
system_prompt.md 작성
chat_contract.py 작성
mock_model.py 작성
run_chat.py 작성
pytest 작성
```

검증:

```bash
python local_ai/harness/run_chat.py "What AWS services does this portfolio use?"
pytest local_ai/tests -q
```

### Phase 2: llama.cpp 연결

목표:

```text
mock model 대신 실제 local llama.cpp server 사용
```

작업:

```text
llama.cpp server 실행 문서화
llama_cpp_client.py 구현
mock/llama.cpp backend switch 추가
timeout/error 처리 추가
```

검증:

```bash
LOCAL_AI_BACKEND=llama.cpp python local_ai/harness/run_chat.py "What does Shinseong build?"
```

### Phase 3: React Ask AI UI

목표:

```text
프론트에서 질문 입력 → pending → answer UI 확인
```

초기에는 mock API 또는 local dev API로 연결한다.

작업:

```text
frontend/src/chatApi.ts
AskAiView 컴포넌트
상태별 UI 테스트
예시 질문 버튼
```

검증:

```bash
cd frontend
npm test
npm run build
```

### Phase 4: AWS relay

목표:

```text
방문자 질문을 AWS가 받고, MacBook agent가 처리
```

추가 AWS 리소스:

```text
SQS queue
DynamoDB table with TTL
Lambda POST /chat
Lambda GET /chat/{requestId}
```

MacBook agent:

```text
poll SQS
call local harness
write result to DynamoDB
delete SQS message
heartbeat update
```

### Phase 5: 운영 안전장치

필수:

```text
질문 길이 제한
rate limit
DynamoDB TTL
agent offline 상태 표시
CloudWatch logs
Budget alarm
```

## 테스트 전략

### Contract tests

목적:

```text
프론트, Lambda, local agent가 같은 JSON 계약을 사용하게 보장
```

테스트:

```text
POST /chat response shape
GET /chat pending shape
GET /chat done shape
error shape
```

### Prompt tests

목적:

```text
모델이 공개 context 안에서만 답하게 하기
```

테스트:

```text
AWS 질문 → v1 AWS 구조 답변
자격증 질문 → SAA/DVA 답변
없는 정보 질문 → 모른다고 답변
개인정보 질문 → 제공 불가 답변
```

### Agent tests

목적:

```text
SQS message 처리 흐름 검증
```

테스트:

```text
message 받기
local model 호출
DynamoDB에 DONE 저장
실패 시 ERROR 저장
성공 후 SQS message 삭제
```

## 완료 기준

v2를 완료했다고 볼 수 있는 조건:

```text
1. 로컬 하네스가 mock model로 안정적으로 답변한다.
2. 같은 하네스가 llama.cpp server와 연결된다.
3. React Ask AI UI가 pending/done/error를 모두 보여준다.
4. AWS relay가 SQS/DynamoDB로 동작한다.
5. MacBook agent를 켜면 실제 방문자 질문에 답한다.
6. MacBook agent를 끄면 UI가 offline 또는 timeout 상태를 보여준다.
7. 모든 실제 secret/resource id는 repo에 커밋되지 않는다.
```

## 추천 첫 구현 커밋 단위

```text
commit 1: add local AI context and prompt contract
commit 2: add mock local chat harness
commit 3: add llama.cpp client backend
commit 4: add Ask AI frontend UI
commit 5: add AWS SQS/DynamoDB relay
commit 6: add local MacBook polling agent
commit 7: document v2 operation and cleanup
```

## 가장 먼저 할 일

다음 작업의 시작점은 이것이다.

```text
local_ai/context/profile.md
local_ai/context/projects.md
local_ai/prompts/system_prompt.md
local_ai/harness/run_chat.py
```

처음 성공시킬 명령:

```bash
python local_ai/harness/run_chat.py "What AWS services does this portfolio use?"
```

이 명령이 안정적인 JSON 답변을 만들면, 그 다음에 llama.cpp와 AWS를 붙인다.
