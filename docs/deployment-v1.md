# V1 Deployment Guide

This project has two deployable pieces:

- `backend/`: SAM API with `GET /health` and `GET /profile`.
- `frontend/`: Vite React static app served from S3 through CloudFront.

## Backend

```bash
cd backend
sam build
sam deploy --guided --region ca-central-1
```

Use the `PortfolioApiBaseUrl` stack output as the frontend API base URL.

## Frontend Hosting

Create or confirm an ACM certificate for your domain in `us-east-1`; CloudFront requires certificates in that region.

```bash
aws cloudformation deploy \
  --region us-east-1 \
  --stack-name portfolio-frontend-hosting \
  --template-file infra/frontend-hosting.yaml \
  --parameter-overrides \
    DomainName=www.example.com \
    HostedZoneId=Z00000000000000000000 \
    AcmCertificateArn=arn:aws:acm:us-east-1:123456789012:certificate/example
```

Build and upload the frontend:

```bash
cd frontend
VITE_API_BASE_URL=https://api-id.execute-api.ca-central-1.amazonaws.com/Prod npm run build
aws s3 sync dist s3://BUCKET_NAME --delete
aws cloudfront create-invalidation --distribution-id DISTRIBUTION_ID --paths "/*"
```

## Cost Guardrail

Before sharing the site publicly, create an AWS Budget near `5 USD` with email alerts. Keep v1 free of SQS, DynamoDB, and visitor counters so the first deployment stays simple.

## V2 Notes

The AI chatbot should add SQS, DynamoDB with TTL, and a MacBook local agent only after v1 is stable. The MacBook should poll AWS outbound instead of accepting inbound traffic.
