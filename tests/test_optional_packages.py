import pytest
import os
import sys
import subprocess
from unittest.mock import patch, MagicMock

from src.core.optional_packages import (
    OPTIONAL_PACKAGE_SETS,
    is_installed,
    get_install_dir,
    patch_sys_path,
    install,
)


def test_optional_package_sets_has_required_keys():
    for provider in ["moonshine", "faster_whisper"]:
        assert provider in OPTIONAL_PACKAGE_SETS
        assert "packages" in OPTIONAL_PACKAGE_SETS[provider]
        assert "install_dir" in OPTIONAL_PACKAGE_SETS[provider]
        assert "install_with_deps" in OPTIONAL_PACKAGE_SETS[provider]
        assert "size_mb" in OPTIONAL_PACKAGE_SETS[provider]


def test_faster_whisper_set_has_onnxruntime_not_transformers():
    pkgs = OPTIONAL_PACKAGE_SETS["faster_whisper"]["packages"]
    assert "onnxruntime" in pkgs
    assert "transformers" not in pkgs


def test_get_install_dir_contains_app_support_and_provider():
    path = get_install_dir("moonshine")
    assert "Parcera" in path
    assert "optional-packages" in path
    assert path.endswith("moonshine")


def test_is_installed_returns_false_when_dir_missing(tmp_path):
    with patch("src.core.optional_packages.get_install_dir") as mock_dir:
        mock_dir.return_value = str(tmp_path / "moonshine_nonexistent")
        assert is_installed("moonshine") is False


def test_is_installed_returns_false_when_dir_empty(tmp_path):
    empty_dir = tmp_path / "moonshine"
    empty_dir.mkdir()
    with patch("src.core.optional_packages.get_install_dir") as mock_dir:
        mock_dir.return_value = str(empty_dir)
        assert is_installed("moonshine") is False


def test_is_installed_returns_true_when_dir_has_files(tmp_path):
    pkg_dir = tmp_path / "moonshine"
    pkg_dir.mkdir()
    (pkg_dir / "moonshine_voice").mkdir()
    (pkg_dir / "moonshine_voice" / "__init__.py").write_text("# stub")
    with patch("src.core.optional_packages.get_install_dir") as mock_dir:
        mock_dir.return_value = str(pkg_dir)
        assert is_installed("moonshine") is True


def test_patch_sys_path_adds_installed_dirs(tmp_path):
    pkg_dir = tmp_path / "moonshine"
    pkg_dir.mkdir()
    (pkg_dir / "some_pkg").mkdir()

    def fake_get_install_dir(provider):
        if provider == "moonshine":
            return str(pkg_dir)
        return str(tmp_path / provider / "nonexistent")

    original_path = sys.path.copy()
    try:
        with patch("src.core.optional_packages.get_install_dir", side_effect=fake_get_install_dir):
            patch_sys_path()
        assert str(pkg_dir) in sys.path
    finally:
        sys.path[:] = original_path


def test_patch_sys_path_does_not_add_nonexistent_dirs(tmp_path):
    original_path = sys.path.copy()
    try:
        with patch("src.core.optional_packages.get_install_dir",
                   return_value=str(tmp_path / "nonexistent")):
            patch_sys_path()
        assert str(tmp_path / "nonexistent") not in sys.path
    finally:
        sys.path[:] = original_path


def test_get_install_dir_unknown_provider_raises_value_error():
    with pytest.raises(ValueError, match="Unknown provider"):
        get_install_dir("nonexistent_provider")


def test_install_unknown_provider_raises_value_error():
    with pytest.raises(ValueError, match="Unknown provider"):
        install("nonexistent_provider")


def test_install_raises_runtime_error_on_timeout(tmp_path):
    with patch("src.core.optional_packages.get_install_dir", return_value=str(tmp_path / "moonshine")):
        with patch("subprocess.run", side_effect=subprocess.TimeoutExpired(cmd=["pip"], timeout=300)):
            with pytest.raises(RuntimeError, match="timed out"):
                install("moonshine")
