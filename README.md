# aws-serverless-portfolio

AWS-hosted portfolio built as a static React app with a small serverless API.

## V1

- Frontend: Vite, React, TypeScript.
- Backend: AWS SAM, Lambda, API Gateway.
- Hosting: private S3 bucket behind CloudFront, with Route 53 for a custom domain.

The React build is still static output. It is uploaded to S3 and calls the API Gateway endpoints at runtime.

## Local development

Backend:

```bash
cd backend
../.venv/bin/python -m pytest tests/unit -q
```

Frontend:

```bash
cd frontend
npm install
npm run dev
npm test
```

Set `VITE_API_BASE_URL` when building against a deployed API:

```bash
VITE_API_BASE_URL=https://api-id.execute-api.ca-central-1.amazonaws.com/Prod npm run build
```

## Deployment

The deployable backend Lambda sources live under `backend/`:

- `backend/portfolio_api/` serves portfolio profile endpoints.
- `backend/chat_api/` serves the async chat API endpoints.

The static hosting stack lives separately in `infra/frontend-hosting.yaml`.

## V2

The local AI worker lives under `local_ai/harness/local_agent/`. It polls SQS, calls the local model server, and writes responses back to DynamoDB. It is not packaged into the SAM Lambda artifact.
