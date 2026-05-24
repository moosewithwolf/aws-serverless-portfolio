# 02_AWS Serverless Portfolio 배포 커맨드 정리

## 목적

이 문서는 서버리스 포트폴리오를 AWS에 배포할 때 사용하는 명령을 일반 예시값으로 정리한 것이다.

최종 흐름:

```text
Frontend build files
→ S3 private bucket
→ CloudFront HTTPS
→ Route 53 example.com

Frontend app
→ API Gateway
→ Lambda
```

## 1. AWS CLI 프로필 설정

디렉터리:

```bash
어디서 실행해도 됨
```

실행:

```bash
aws configure --profile YOUR_AWS_PROFILE
```

왜 했는지:

```text
AWS CLI가 어떤 IAM 사용자로 AWS에 접근할지 저장하기 위해서.
YOUR_AWS_PROFILE은 이 프로젝트용 AWS CLI 프로필 이름이다.
```

입력값:

```text
AWS Access Key ID: YOUR_ACCESS_KEY_ID
AWS Secret Access Key: YOUR_SECRET_ACCESS_KEY
Default region name: YOUR_BACKEND_REGION
Default output format: json
```

확인:

```bash
aws sts get-caller-identity --profile YOUR_AWS_PROFILE
```

라인별 의미:

```bash
# AWS 계정/사용자 연결 확인
aws sts get-caller-identity \
  # YOUR_AWS_PROFILE 프로필에 저장된 access key 사용
  --profile YOUR_AWS_PROFILE
```

## 2. 백엔드 API 배포

디렉터리:

```bash
cd /path/to/your-serverless-portfolio/backend
```

실행:

```bash
source ../.venv/bin/activate
sam build
sam deploy --guided --region YOUR_BACKEND_REGION --profile YOUR_AWS_PROFILE
```

왜 했는지:

```text
Lambda + API Gateway를 AWS YOUR_BACKEND_REGION 리전에 배포하기 위해서.
```

라인별 의미:

```bash
# Python 가상환경 켜기
source ../.venv/bin/activate

# SAM 템플릿을 읽고 Lambda 배포 준비물 생성
sam build

# SAM 배포 시작
sam deploy --guided \
  # Lambda/API Gateway를 선택한 백엔드 리전에 배포
  --region YOUR_BACKEND_REGION \
  # YOUR_AWS_PROFILE AWS CLI 프로필 사용
  --profile YOUR_AWS_PROFILE
```

`sam deploy --guided` 입력값:

```text
Stack Name: your-portfolio-api-stack
AWS Region: YOUR_BACKEND_REGION
Confirm changes before deploy: Y
Allow SAM CLI IAM role creation: Y
Disable rollback: N
PortfolioApiFunction has no authentication. Is this okay?: y
Deploy this changeset?: y
```

중요 결과:

```text
PortfolioApiBaseUrl = https://YOUR_API_ID.execute-api.YOUR_BACKEND_REGION.amazonaws.com/Prod
```

API 확인:

```bash
curl https://YOUR_API_ID.execute-api.YOUR_BACKEND_REGION.amazonaws.com/Prod/health
```

기대 결과:

```json
{"status":"ok","service":"your-portfolio-api"}
```

## 3. Route 53 Hosted Zone 생성

디렉터리:

```bash
어디서 실행해도 됨
```

실행:

```bash
aws route53 create-hosted-zone \
  --name example.com \
  --caller-reference example-com-UNIQUE_TIMESTAMP \
  --profile YOUR_AWS_PROFILE
```

왜 했는지:

```text
example.com DNS 관리를 AWS Route 53에서 하기 위해서.
```

라인별 의미:

```bash
# Route 53 hosted zone 생성
aws route53 create-hosted-zone \
  # 관리할 도메인 이름
  --name example.com \
  # 중복 요청 방지용 고유 문자열
  --caller-reference example-com-UNIQUE_TIMESTAMP \
  # YOUR_AWS_PROFILE 프로필 사용
  --profile YOUR_AWS_PROFILE
```

생성된 값:

```text
HostedZoneId = YOUR_HOSTED_ZONE_ID
```

도메인 등록기관에 등록한 네임서버:

```text
ns-XXXX.awsdns-XX.co.uk
ns-XXXX.awsdns-XX.org
ns-XXXX.awsdns-XX.com
ns-XXXX.awsdns-XX.net
```

왜 네임서버를 바꿨는지:

```text
도메인 등록기관에게 "example.com의 DNS 관리는 Route 53이 한다"고 알려주기 위해서.
```

## 4. ACM 인증서 생성

디렉터리:

```bash
어디서 실행해도 됨
```

실행:

```bash
aws acm request-certificate \
  --region us-east-1 \
  --domain-name example.com \
  --validation-method DNS \
  --profile YOUR_AWS_PROFILE
```

왜 했는지:

```text
CloudFront에서 example.com를 HTTPS로 열기 위해서.
CloudFront용 ACM 인증서는 us-east-1에 있어야 한다.
```

라인별 의미:

```bash
# HTTPS 인증서 요청
aws acm request-certificate \
  # CloudFront용 인증서는 us-east-1에서 생성
  --region us-east-1 \
  # 인증서를 발급할 도메인
  --domain-name example.com \
  # DNS 레코드로 도메인 소유권 검증
  --validation-method DNS \
  # YOUR_AWS_PROFILE 프로필 사용
  --profile YOUR_AWS_PROFILE
```

생성된 인증서 ARN:

```text
arn:aws:acm:us-east-1:YOUR_ACCOUNT_ID:certificate/YOUR_CERTIFICATE_ID
```

## 5. ACM DNS 검증 레코드 확인

실행:

```bash
aws acm describe-certificate \
  --region us-east-1 \
  --certificate-arn arn:aws:acm:us-east-1:YOUR_ACCOUNT_ID:certificate/YOUR_CERTIFICATE_ID \
  --profile YOUR_AWS_PROFILE \
  --query "Certificate.DomainValidationOptions[0].ResourceRecord"
```

왜 했는지:

```text
ACM이 요구하는 CNAME 검증 레코드를 확인하기 위해서.
이 CNAME을 DNS에 넣으면 AWS가 도메인 소유권을 확인한다.
```

나온 값:

```text
Name  = _YOUR_ACM_VALIDATION_NAME.example.com.
Type  = CNAME
Value = _YOUR_ACM_VALIDATION_VALUE.acm-validations.aws.
```

## 6. Route 53에 ACM 검증 CNAME 추가

실행:

```bash
aws route53 change-resource-record-sets \
  --hosted-zone-id YOUR_HOSTED_ZONE_ID \
  --profile YOUR_AWS_PROFILE \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "_YOUR_ACM_VALIDATION_NAME.example.com.",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{
          "Value": "_YOUR_ACM_VALIDATION_VALUE.acm-validations.aws."
        }]
      }
    }]
  }'
```

왜 했는지:

```text
AWS ACM에게 "내가 example.com DNS를 수정할 권한이 있다"는 것을 증명하기 위해서.
```

라인별 의미:

```bash
# Route 53 DNS 레코드 변경
aws route53 change-resource-record-sets \
  # example.com hosted zone ID
  --hosted-zone-id YOUR_HOSTED_ZONE_ID \
  # YOUR_AWS_PROFILE 프로필 사용
  --profile YOUR_AWS_PROFILE \
  # DNS 변경 내용
  --change-batch '{ ... }'
```

인증서 상태 확인:

```bash
aws acm describe-certificate \
  --region us-east-1 \
  --certificate-arn arn:aws:acm:us-east-1:YOUR_ACCOUNT_ID:certificate/YOUR_CERTIFICATE_ID \
  --profile YOUR_AWS_PROFILE \
  --query "Certificate.Status"
```

완료 상태:

```text
ISSUED
```

## 7. 프론트 호스팅 인프라 생성

디렉터리:

```bash
cd /path/to/your-serverless-portfolio
```

실행:

```bash
aws cloudformation deploy \
  --region us-east-1 \
  --profile YOUR_AWS_PROFILE \
  --stack-name your-frontend-hosting-stack \
  --template-file infra/frontend-hosting.yaml \
  --parameter-overrides \
    DomainName=example.com \
    HostedZoneId=YOUR_HOSTED_ZONE_ID \
    AcmCertificateArn=arn:aws:acm:us-east-1:YOUR_ACCOUNT_ID:certificate/YOUR_CERTIFICATE_ID
```

왜 했는지:

```text
프론트엔드 사이트를 담을 S3 bucket, CloudFront, Route 53 alias record를 만들기 위해서.
```

라인별 의미:

```bash
# CloudFormation으로 프론트 인프라 생성/업데이트
aws cloudformation deploy \
  # CloudFront와 ACM 인증서 때문에 us-east-1 사용
  --region us-east-1 \
  # YOUR_AWS_PROFILE 프로필 사용
  --profile YOUR_AWS_PROFILE \
  # CloudFormation stack 이름
  --stack-name your-frontend-hosting-stack \
  # 만들 리소스가 정의된 템플릿 파일
  --template-file infra/frontend-hosting.yaml \
  # 템플릿에 전달할 값들
  --parameter-overrides \
    # 실제 접속할 도메인
    DomainName=example.com \
    # Route 53 hosted zone ID
    HostedZoneId=YOUR_HOSTED_ZONE_ID \
    # CloudFront에 붙일 HTTPS 인증서
    AcmCertificateArn=arn:aws:acm:us-east-1:YOUR_ACCOUNT_ID:certificate/YOUR_CERTIFICATE_ID
```

생성된 주요 출력:

```text
BucketName = YOUR_FRONTEND_BUCKET_NAME
CloudFrontDistributionId = YOUR_CLOUDFRONT_DISTRIBUTION_ID
WebsiteUrl = https://example.com
CloudFrontDomainName = YOUR_DISTRIBUTION.cloudfront.net
```

## 8. 프론트엔드 앱 빌드

디렉터리:

```bash
cd /path/to/your-serverless-portfolio/frontend
```

실행:

```bash
VITE_API_BASE_URL=https://YOUR_API_ID.execute-api.YOUR_BACKEND_REGION.amazonaws.com/Prod npm run build
```

왜 했는지:

```text
프론트엔드 앱 안에 실제 API Gateway URL을 넣고 정적 파일로 빌드하기 위해서.
Vite는 VITE_API_BASE_URL 값을 빌드 시점에 JS 파일 안에 넣는다.
```

라인별 의미:

```bash
# 프론트엔드 앱에서 사용할 API Gateway 주소 설정
VITE_API_BASE_URL=https://YOUR_API_ID.execute-api.YOUR_BACKEND_REGION.amazonaws.com/Prod \
  # Vite production build 실행
  npm run build
```

생성 결과:

```text
frontend/dist/
```

## 9. S3에 React build 업로드

디렉터리:

```bash
cd /path/to/your-serverless-portfolio/frontend
```

실행:

```bash
aws s3 sync dist s3://YOUR_FRONTEND_BUCKET_NAME --delete --profile YOUR_AWS_PROFILE
```

왜 했는지:

```text
빌드된 프론트엔드 정적 파일을 S3 bucket에 올리기 위해서.
CloudFront는 이 S3 bucket을 origin으로 사용한다.
```

라인별 의미:

```bash
# 로컬 dist 폴더와 S3 bucket 내용을 동기화
aws s3 sync dist s3://YOUR_FRONTEND_BUCKET_NAME \
  # 로컬에 없는 오래된 S3 파일은 삭제
  --delete \
  # YOUR_AWS_PROFILE 프로필 사용
  --profile YOUR_AWS_PROFILE
```

## 10. CloudFront 캐시 무효화

실행:

```bash
aws cloudfront create-invalidation \
  --distribution-id YOUR_CLOUDFRONT_DISTRIBUTION_ID \
  --paths "/*" \
  --profile YOUR_AWS_PROFILE
```

왜 했는지:

```text
CloudFront가 이전 파일을 캐시하고 있을 수 있어서, 새로 올린 프론트엔드 파일을 바로 반영하기 위해서.
```

라인별 의미:

```bash
# CloudFront 캐시 무효화 요청 생성
aws cloudfront create-invalidation \
  # CloudFront distribution ID
  --distribution-id YOUR_CLOUDFRONT_DISTRIBUTION_ID \
  # 모든 경로 캐시 삭제
  --paths "/*" \
  # YOUR_AWS_PROFILE 프로필 사용
  --profile YOUR_AWS_PROFILE
```

## 11. 최종 확인

브라우저:

```text
https://example.com
```

확인한 것:

```text
사이트 로드 성공
API connected 표시
Resume 탭 정상
AI Roadmap 탭 정상
브라우저 console error/warn 없음
```

API 직접 확인:

```bash
curl https://YOUR_API_ID.execute-api.YOUR_BACKEND_REGION.amazonaws.com/Prod/health
```

기대 결과:

```json
{"status":"ok","service":"your-portfolio-api"}
```

## 전체 요약

이번 배포에서 만든 AWS 구조:

```text
example.com
→ Route 53
→ CloudFront
→ private S3 bucket
→ Frontend static files
```

프론트와 백엔드 연결:

```text
Frontend app
→ API Gateway
→ Lambda
→ /health, /profile 응답
```

핵심 학습 포인트:

```text
1. SAM으로 Lambda/API Gateway 배포
2. Route 53으로 도메인 DNS 관리
3. ACM으로 HTTPS 인증서 발급
4. CloudFront로 HTTPS CDN 구성
5. S3 private bucket에 정적 프론트엔드 파일 배포
6. React build 시점에 API URL 주입
```
