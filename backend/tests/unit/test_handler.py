import json

from portfolio_api import app


def invoke(path, method="GET"):
    return app.lambda_handler(
        {
            "rawPath": path,
            "path": path,
            "requestContext": {"http": {"method": method}},
            "httpMethod": method,
        },
        "",
    )


def body(response):
    return json.loads(response["body"])


def test_health_returns_portfolio_api_status():
    response = invoke("/health")

    assert response["statusCode"] == 200
    assert response["headers"]["Access-Control-Allow-Origin"] == "*"
    assert body(response) == {"status": "ok", "service": "portfolio-api"}


def test_profile_returns_summary_projects_resume_and_roadmap():
    response = invoke("/profile")
    payload = body(response)

    assert response["statusCode"] == 200
    assert payload["name"] == "Shinseong Kim"
    assert "Computer Programming student" in payload["headline"]
    assert [project["name"] for project in payload["projects"]] == [
        "NoraHangul",
        "Cloud Native Backend",
        "GS Power Legacy Website",
        "Lofi Nest",
        "Pixels Legacy Media Website",
    ]
    assert "AWS Solutions Architect Associate" in payload["certifications"]
    assert payload["aiRoadmap"]["runtime"] == "llama.cpp"


def test_options_request_returns_cors_headers():
    response = invoke("/profile", method="OPTIONS")

    assert response["statusCode"] == 204
    assert response["headers"]["Access-Control-Allow-Origin"] == "*"
    assert "GET" in response["headers"]["Access-Control-Allow-Methods"]


def test_unknown_route_returns_not_found():
    response = invoke("/missing")

    assert response["statusCode"] == 404
    assert body(response)["message"] == "Not found"
