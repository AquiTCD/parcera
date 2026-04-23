import json
import pytest
from unittest.mock import patch, MagicMock
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.routers.optional_packages_router import create_optional_packages_router


@pytest.fixture
def client():
    app = FastAPI()
    router = create_optional_packages_router()
    app.include_router(router)
    return TestClient(app)


def test_status_returns_all_providers(client):
    fake_dirs = {
        "moonshine": "/fake/moonshine",
        "faster_whisper": "/fake/faster_whisper",
    }
    installed = {"moonshine": True, "faster_whisper": False}

    def fake_get_install_dir(provider):
        return fake_dirs[provider]

    def fake_is_installed(provider):
        return installed[provider]

    with patch("src.routers.optional_packages_router.get_install_dir", side_effect=fake_get_install_dir):
        with patch("src.routers.optional_packages_router.is_installed", side_effect=fake_is_installed):
            response = client.get("/optional-packages/status")

    assert response.status_code == 200
    data = response.json()
    assert "moonshine" in data
    assert "faster_whisper" in data
    assert data["moonshine"]["installed"] is True
    assert data["faster_whisper"]["installed"] is False
    assert data["moonshine"]["size_mb"] == 120
    assert data["faster_whisper"]["size_mb"] == 200
    assert data["moonshine"]["install_dir"] == "/fake/moonshine"


def test_install_unknown_provider_returns_422(client):
    response = client.post("/optional-packages/install?provider=nonexistent")
    assert response.status_code == 422


def test_install_streams_sse_events(client):
    progress_events = [
        {"status": "installing", "progress": 0, "provider": "moonshine"},
        {"status": "complete", "progress": 100, "provider": "moonshine"},
    ]

    def fake_install(provider, progress_callback=None):
        for event in progress_events:
            if progress_callback:
                progress_callback(event)

    with patch("src.routers.optional_packages_router.install", side_effect=fake_install):
        response = client.post("/optional-packages/install?provider=moonshine")

    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]

    lines = [l for l in response.text.splitlines() if l.startswith("data: ")]
    payloads = [json.loads(l[len("data: "):]) for l in lines]
    statuses = [p["status"] for p in payloads]
    assert "complete" in statuses


def test_install_streams_error_on_exception(client):
    def failing_install(provider, progress_callback=None):
        raise RuntimeError("pip failed")

    with patch("src.routers.optional_packages_router.install", side_effect=failing_install):
        response = client.post("/optional-packages/install?provider=moonshine")

    assert response.status_code == 200
    lines = [l for l in response.text.splitlines() if l.startswith("data: ")]
    payloads = [json.loads(l[len("data: "):]) for l in lines]
    error_events = [p for p in payloads if p.get("status") == "error"]
    assert len(error_events) == 1
    assert "pip failed" in error_events[0]["error"]
