#!/usr/bin/env python3
"""Manage the already-installed local backend independently of Next.js."""

import argparse
import json
import os
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from dev import ROOT, read_env

UNIT = "finder-keeper-backend.service"
PYTHON = ROOT / "backend/.venv/bin/python"


def runtime_port():
    """Validate an existing local library without installing or seeding one."""
    for key, value in read_env(ROOT / ".env").items():
        os.environ.setdefault(key, value)
    os.chdir(ROOT / "backend")
    sys.path.insert(0, str(ROOT / "backend"))
    from app.config import settings

    if (settings.auth_mode != "local" or settings.storage_backend != "local"
            or settings.embedding_provider != "fastembed"
            or not settings.db_url.startswith("sqlite:///")):
        raise RuntimeError("This launcher only supports an existing local library.")
    settings.validate_runtime()
    if not Path(settings.db_url.removeprefix("sqlite:///")).is_file():
        raise RuntimeError("Local library database is missing; use the normal setup workflow.")
    if settings.seed_library and not (settings.data_dir / ".starter-seeded").is_file():
        raise RuntimeError("Starter library is not initialized; use the normal setup workflow.")
    cache = settings.data_dir / "models"
    if (settings.embedding_model != "BAAI/bge-small-en-v1.5"
            or not any(cache.glob("models--Qdrant--bge-small-en-v1.5-onnx-Q/snapshots/*/model_optimized.onnx"))):
        raise RuntimeError("The local embedding model is not cached; use the normal setup workflow.")
    port = int(os.environ.get("BACKEND_PORT", "8010"))
    if not 1024 <= port <= 65535 or port == 3000:
        raise RuntimeError("BACKEND_PORT must be 1024–65535 and different from frontend port 3000.")
    return port


def ready(port):
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/status", timeout=2) as response:
            state = json.load(response)
        return state.get("embedding_ready") and not state.get("startup_error")
    except (OSError, ValueError, urllib.error.URLError):
        return False


def unit_state():
    result = subprocess.run(["systemctl", "--user", "show", UNIT, "--property=ActiveState", "--value"], capture_output=True, text=True)
    return result.stdout.strip() if result.returncode == 0 else "inactive"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("start", "stop", "status", "_check", "_run"), nargs="?", default="start")
    args = parser.parse_args()
    if args.action in ("_check", "_run"):
        port = runtime_port()
        if args.action == "_check":
            print(port)
            return 0
        os.execv(str(PYTHON), [str(PYTHON), "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(port)])

    if not all(shutil.which(command) for command in ("systemctl", "systemd-run")):
        raise RuntimeError("This launcher needs a Linux systemd user session; use scripts/dev.sh otherwise.")
    if args.action == "status":
        return subprocess.run(["systemctl", "--user", "show", UNIT, "--property=ActiveState", "--property=SubState", "--property=MainPID"]).returncode
    if args.action == "stop":
        if unit_state() in ("active", "activating", "reloading", "deactivating"):
            return subprocess.run(["systemctl", "--user", "stop", UNIT]).returncode
        print("The managed backend is already stopped.")
        return 0
    if not PYTHON.is_file():
        raise RuntimeError("Backend dependencies are missing; run the normal setup workflow first.")
    check = subprocess.run([str(PYTHON), str(Path(__file__).resolve()), "_check"], capture_output=True, text=True)
    if check.returncode:
        print(check.stderr.strip(), file=sys.stderr)
        return check.returncode
    port = int(check.stdout.strip())
    active = unit_state() in ("active", "activating", "reloading")
    if not active:
        with socket.socket() as probe:
            probe.settimeout(1)
            if probe.connect_ex(("127.0.0.1", port)) == 0:
                raise RuntimeError("The backend port is already occupied by an unmanaged process; it was left untouched.")
        subprocess.run([
            "systemd-run", "--user", f"--unit={UNIT}", "--description=Finder-Keeper local library for this login",
            "--collect", "--service-type=exec", "--property=Restart=on-failure", "--property=RestartSec=3",
            f"--working-directory={ROOT / 'backend'}", str(PYTHON), str(Path(__file__).resolve()), "_run",
        ], check=True)
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        if ready(port):
            print(f"Local library ready at http://127.0.0.1:{port}; Next.js was left untouched.")
            return 0
        time.sleep(.25)
    print(f"Backend is not ready yet. Inspect: journalctl --user-unit={UNIT} -n 40", file=sys.stderr)
    return 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except RuntimeError as error:
        print(error, file=sys.stderr)
        sys.exit(1)
    except Exception as error:
        # Configuration validation can contain values: never print them to the terminal.
        print(f"Backend launch failed ({type(error).__name__}); no settings were printed.", file=sys.stderr)
        sys.exit(1)
