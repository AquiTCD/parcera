"""Security tests for /config/obs-asset endpoint."""
import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from fastapi import FastAPI
from routers.config_router import create_config_router


def _make_client(assets_dir: Path | None = None):
    """Create a test client with a mock server whose assets_dir is set."""
    mock_server = MagicMock()
    mock_server.config.get.return_value = {}

    if assets_dir is not None:
        mock_server.config.get.return_value = {
            "user": {"assets_dir": str(assets_dir)},
            "ai": {"assets_dir": str(assets_dir)},
        }

    app = FastAPI()
    router = create_config_router(lambda: mock_server)
    app.include_router(router)
    return TestClient(app, raise_server_exceptions=False)


def test_invalid_avatar_type_returns_404(tmp_path):
    """Unrecognized avatar_type values must be rejected before any filesystem access."""
    client = _make_client()
    response = client.get("/config/obs-asset/../../etc/passwd/base.png")
    assert response.status_code == 404

def test_unknown_avatar_type_string_returns_404(tmp_path):
    """Arbitrary strings like 'admin' or 'system' are not valid avatar types."""
    client = _make_client()
    for bad_type in ("admin", "system", "root", "../user", "."):
        response = client.get(f"/config/obs-asset/{bad_type}/base.png")
        assert response.status_code == 404, f"Expected 404 for avatar_type={bad_type!r}"

def test_valid_avatar_type_with_missing_file_returns_404(tmp_path):
    """Valid type and real assets dir, but requested file does not exist → 404."""
    assets = tmp_path / "user"
    assets.mkdir()
    # No files created — directory exists but is empty

    mock_server = MagicMock()
    mock_server.config.get.return_value = {"user": {"assets_dir": str(assets)}}

    app = FastAPI()
    router = create_config_router(lambda: mock_server)
    app.include_router(router)
    client = TestClient(app, raise_server_exceptions=False)

    response = client.get("/config/obs-asset/user/nonexistent.png")
    assert response.status_code == 404

def test_valid_avatar_type_serves_file(tmp_path):
    """Valid type with a real assets dir and file → 200."""
    assets = tmp_path / "user"
    assets.mkdir()
    (assets / "base.png").write_bytes(b"\x89PNG\r\n")

    mock_server = MagicMock()
    mock_server.config.get.return_value = {"user": {"assets_dir": str(assets)}}

    app = FastAPI()
    router = create_config_router(lambda: mock_server)
    app.include_router(router)
    client = TestClient(app, raise_server_exceptions=False)

    response = client.get("/config/obs-asset/user/base.png")
    assert response.status_code == 200

def test_path_traversal_in_filename_returns_403(tmp_path):
    """../secret in filename must be blocked by the existing traversal guard."""
    assets = tmp_path / "user"
    assets.mkdir()

    mock_server = MagicMock()
    mock_server.config.get.return_value = {"user": {"assets_dir": str(assets)}}

    app = FastAPI()
    router = create_config_router(lambda: mock_server)
    app.include_router(router)
    client = TestClient(app, raise_server_exceptions=False)

    response = client.get("/config/obs-asset/user/..%2F..%2Fetc%2Fpasswd")
    assert response.status_code in (403, 404)
