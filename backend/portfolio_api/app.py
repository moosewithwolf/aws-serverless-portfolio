import json

try:
    from .profile_data import PROFILE
except ImportError:
    from profile_data import PROFILE


CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
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
