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

See `docs/deployment-v1.md`.

## V2

The local AI chatbot is intentionally deferred. The planned design uses SQS, DynamoDB with TTL, and a MacBook agent that polls AWS outbound and calls local `llama.cpp`.
