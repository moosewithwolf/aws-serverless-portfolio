"""Unit tests for the docker-compose.yml validation.

These tests parse the docker-compose.yml file and verify that it
conforms to the security isolation requirements (localhost binding,
no privileged mode, no dangerous volume mounts, etc.).
"""

import pathlib
import pytest
import yaml


_COMPOSE_PATH = pathlib.Path(__file__).parent.parent.parent / "docker-compose.yml"


@pytest.fixture
def compose_config():
    """Load the docker-compose.yml as a dict."""
    assert _COMPOSE_PATH.exists(), f"docker-compose.yml not found at {_COMPOSE_PATH}"
    with open(_COMPOSE_PATH, "r") as f:
        return yaml.safe_load(f)


# ---------------------------------------------------------------------------
# Port binding — localhost only
# ---------------------------------------------------------------------------


def test_port_is_localhost_only(compose_config):
    """Verify the model port is bound to 127.0.0.1, not 0.0.0.0."""
    services = compose_config.get("services", {})
    assert "model-server" in services, "Expected 'model-server' service"

    ports = services["model-server"].get("ports", [])
    assert len(ports) >= 1, "Expected at least one port mapping"

    for port_mapping in ports:
        port_str = str(port_mapping)
        # Port mappings look like "127.0.0.1:8080:8080" or "127.0.0.1:8080:8080/tcp"
        if ":" in port_str:
            host_part = port_str.split(":")[0]
            assert host_part == "127.0.0.1", (
                f"Port should be localhost-only, got host binding: {host_part}"
            )


# ---------------------------------------------------------------------------
# No privileged mode
# ---------------------------------------------------------------------------


def test_no_privileged_mode(compose_config):
    """Verify privileged mode is not enabled."""
    services = compose_config.get("services", {})
    model_server = services.get("model-server", {})
    assert model_server.get("privileged") is not True, (
        "Container must not run in privileged mode"
    )


# ---------------------------------------------------------------------------
# No Docker socket mount
# ---------------------------------------------------------------------------


def test_no_docker_socket_mount(compose_config):
    """Verify the Docker socket is not mounted into the container."""
    services = compose_config.get("services", {})
    model_server = services.get("model-server", {})
    volumes = model_server.get("volumes", []) or []

    for vol in volumes:
        vol_str = str(vol)
        assert "/var/run/docker.sock" not in vol_str, (
            "Docker socket must not be mounted"
        )


# ---------------------------------------------------------------------------
# No AWS credential mount
# ---------------------------------------------------------------------------


def test_no_aws_credential_mount(compose_config):
    """Verify ~/.aws is not mounted into the container."""
    services = compose_config.get("services", {})
    model_server = services.get("model-server", {})
    volumes = model_server.get("volumes", []) or []

    for vol in volumes:
        vol_str = str(vol).replace("~", "").replace("/", "")
        assert ".aws" not in vol_str, (
            "AWS credentials directory must not be mounted"
        )


# ---------------------------------------------------------------------------
# No SSH key mount
# ---------------------------------------------------------------------------


def test_no_ssh_key_mount(compose_config):
    """Verify ~/.ssh is not mounted into the container."""
    services = compose_config.get("services", {})
    model_server = services.get("model-server", {})
    volumes = model_server.get("volumes", []) or []

    for vol in volumes:
        vol_str = str(vol).replace("~", "").replace("/", "")
        assert ".ssh" not in vol_str, (
            "SSH key directory must not be mounted"
        )


# ---------------------------------------------------------------------------
# No home directory mount
# ---------------------------------------------------------------------------


def test_no_home_directory_mount(compose_config):
    """Verify $HOME or ~ is not mounted as a volume."""
    services = compose_config.get("services", {})
    model_server = services.get("model-server", {})
    volumes = model_server.get("volumes", []) or []

    for vol in volumes:
        vol_str = str(vol)
        assert vol_str.startswith("~") is False, (
            "Home directory must not be mounted as a volume"
        )
        assert vol_str.startswith("/home/") is False, (
            "Home directory path must not be mounted as a volume"
        )


# ---------------------------------------------------------------------------
# Image — llama.cpp server
# ---------------------------------------------------------------------------


def test_model_image_is_llama_cpp(compose_config):
    """Verify the model-server uses the llama.cpp server image."""
    services = compose_config.get("services", {})
    model_server = services.get("model-server", {})
    image = model_server.get("image", "")
    assert "ggml-org/llama.cpp" in image, (
        f"Expected llama.cpp server image, got: {image}"
    )


# ---------------------------------------------------------------------------
# Volume mount — read-only
# ---------------------------------------------------------------------------


def test_model_volume_mount_is_read_only(compose_config):
    """Verify the model volume mount uses read-only (:ro:) flag."""
    services = compose_config.get("services", {})
    model_server = services.get("model-server", {})
    volumes = model_server.get("volumes", []) or []

    model_volumes = [v for v in volumes if "/models" in str(v)]
    assert len(model_volumes) >= 1, "Expected a /models volume mount"

    for vol in model_volumes:
        vol_str = str(vol)
        assert ":ro" in vol_str, (
            f"Model mount must be read-only, got: {vol_str}"
        )


def test_model_path_is_configurable_with_env_vars(compose_config):
    """Model directory and file should be configurable without editing compose."""
    services = compose_config.get("services", {})
    model_server = services.get("model-server", {})
    volumes = model_server.get("volumes", []) or []
    command = str(model_server.get("command", ""))

    assert any("${LOCAL_MODEL_DIR:-" in str(volume) for volume in volumes), (
        "Model directory should use LOCAL_MODEL_DIR with a default"
    )
    assert "${LOCAL_MODEL_FILE:-" in command, (
        "Model file should use LOCAL_MODEL_FILE with a default"
    )
