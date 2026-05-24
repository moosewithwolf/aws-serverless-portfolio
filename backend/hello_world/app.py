import json


CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
}


PROFILE = {
    "name": "Shinseong Kim",
    "headline": "Full-Stack Developer & Cloud Architect",
    "summary": (
        "Computer Programming and Analysis student focused on AWS, "
        "serverless systems, and practical full-stack engineering."
    ),
    "email": "skim570@myseneca.ca",
    "projects": [
        {
            "name": "NoraHangul",
            "tag": "Spring Boot / React / AWS",
            "description": (
                "Student management system with OAuth2/JWT authentication "
                "and automated deployment using Docker and GitHub Actions."
            ),
        },
        {
            "name": "Cloud Native Backend",
            "tag": "AWS Lambda / SAM",
            "description": (
                "Serverless portfolio backend using API Gateway, Lambda, "
                "CloudFront, S3, and a roadmap for local AI integration."
            ),
        },
    ],
    "skills": [
        "Python",
        "JavaScript",
        "TypeScript",
        "React",
        "Spring Boot",
        "AWS",
        "Docker",
        "PostgreSQL",
        "MongoDB",
    ],
    "certifications": [
        "AWS Solutions Architect Associate",
        "AWS Developer Associate",
    ],
    "education": {
        "program": "Computer Programming and Analysis",
        "school": "Seneca Polytechnic",
        "location": "Toronto, ON",
        "status": "2024 - Present",
    },
    "aiRoadmap": {
        "runtime": "llama.cpp",
        "status": "planned-v2",
        "description": (
            "Visitor questions will be relayed through AWS to a local MacBook "
            "agent running a small llama.cpp model."
        ),
    },
}


def lambda_handler(event, context):
    method = _method(event)
    path = _path(event)

    if method == "OPTIONS":
        return _response(204, None)

    if method != "GET":
        return _response(405, {"message": "Method not allowed"})

    if path == "/health":
        return _response(200, {"status": "ok", "service": "portfolio-api"})

    if path == "/profile":
        return _response(200, PROFILE)

    return _response(404, {"message": "Not found"})


def _method(event):
    return (
        event.get("requestContext", {})
        .get("http", {})
        .get("method", event.get("httpMethod", "GET"))
    )


def _path(event):
    return event.get("rawPath") or event.get("path") or "/"


def _response(status_code, payload):
    response = {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
    }
    if payload is not None:
        response["body"] = json.dumps(payload)
    else:
        response["body"] = ""
    return response
