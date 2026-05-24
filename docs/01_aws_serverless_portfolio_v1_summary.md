# 01_AWS Serverless Portfolio V1 Summary

## 한 줄 요약

`frontend/최종.html` 기반 포트폴리오를 Vite + React + TypeScript 정적 앱으로 바꾸고, AWS Lambda/API Gateway 백엔드와 S3/CloudFront/Route 53 배포 구조까지 준비했다.

## 프론트엔드

- `frontend/최종.html` 디자인을 기준으로 React 앱을 새로 구성했다.
- `Home`, `Projects`, `Resume`, `AI Roadmap` 탭을 React 컴포넌트로 분리했다.
- `API connected` / `API offline` 상태 표시를 추가했다.
- `VITE_API_BASE_URL` 환경변수로 API Gateway 주소를 연결할 수 있게 했다.
- React 앱은 빌드하면 정적 파일이 되므로 S3 + CloudFront에서 서빙 가능하다.

연결 흐름:

```text
Browser
→ React static files
→ API Gateway URL
→ Lambda
```

## 백엔드

기존 `hello world` Lambda를 포트폴리오 API로 교체했다.

구현한 API:

```text
GET /health
GET /profile
OPTIONS /health
OPTIONS /profile
```

역할:

- `/health`: 프론트가 서버리스 API 연결 상태를 확인한다.
- `/profile`: 이름, 프로젝트, 스킬, 자격증, AI roadmap 데이터를 제공한다.
- `OPTIONS`: 브라우저 CORS preflight 요청에 대응한다.

## AWS 인프라

CloudFormation 템플릿으로 프론트 호스팅 구조를 준비했다.

구조:

```text
Route 53 custom domain
→ CloudFront HTTPS
→ private S3 bucket
→ React build files
```

핵심 이유:

- S3 bucket은 public으로 열지 않는다.
- CloudFront Origin Access Control만 S3에 접근하게 한다.
- Route 53 + ACM + CloudFront로 커스텀 도메인 HTTPS를 연습할 수 있다.
- 실제 배포 시 `frontend/dist`를 S3에 업로드하면 된다.

## 문서와 배포 가이드

- `docs/deployment-v1.md`에 v1 배포 흐름을 정리했다.
- 포함된 내용:
  - SAM backend 배포
  - React build
  - S3 sync
  - CloudFront invalidation
  - v2 local AI chatbot 확장 방향

## 테스트와 검증

확인한 항목:

```text
Backend unit tests: 4 passed
Frontend tests: 3 passed
Frontend build: success
SAM backend template validate: success
SAM frontend hosting template validate: success
```

## 현재 로컬 테스트 포인트

백엔드 없이 프론트만 켜면:

```text
API offline
```

SAM local API를 켜고 프론트를 API URL과 함께 실행하면:

```text
API connected
```

프론트 실행:

```bash
cd frontend
VITE_API_BASE_URL=http://127.0.0.1:3000 npm run dev
```

백엔드 실행:

```bash
cd backend
source ../.venv/bin/activate
sam build
sam local start-api --port 3000
```

## V2 로드맵

v2에서는 방문자용 로컬 AI 챗봇을 붙인다.

예상 구조:

```text
Visitor question
→ API Gateway / Lambda
→ SQS
→ MacBook local agent
→ local llama.cpp model
→ DynamoDB result
→ React UI polling
```

핵심 원칙:

- MacBook에 inbound port를 열지 않는다.
- MacBook agent가 AWS로 outbound polling한다.
- 로컬 `llama.cpp` 모델은 Shinseong 관련 질문만 답하게 한다.
- SQS/DynamoDB는 v1 이후 관리 복잡도를 감당할 준비가 됐을 때 추가한다.

## 핵심 결과

현재 프로젝트는 다음 형태가 됐다.

```text
정적 React 포트폴리오
+ Lambda/API Gateway 데이터 API
+ S3/CloudFront/Route 53 배포 준비
+ v2 local llama.cpp chatbot 확장 자리
```
