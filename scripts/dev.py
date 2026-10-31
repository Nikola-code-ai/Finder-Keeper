#!/usr/bin/env python3
"""Run only this project's local services; stop their process groups on exit."""

import os
import shutil
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


def read_env(path: Path) -> dict[str, str]:
    """Read simple KEY=value settings without executing shell expressions."""
    result = {}
    if not path.exists():
        return result
    for number, raw in enumerate(path.read_text().splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:]
        key, separator, value = line.partition("=")
        key, value = key.strip(), value.strip()
        if not separator or not key.replace("_", "").isalnum() or key[0].isdigit():
            raise ValueError(f"Invalid .env assignment on line {number}")
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        result[key] = value
    return result


def port_available(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        try:
            sock.bind(("127.0.0.1", port))
        except OSError:
            return False
    return True


def main() -> int:
    for dependency in ("npm", "uv"):
        if not shutil.which(dependency):
            print(f"Missing {dependency}; run setup-local.sh after installing prerequisites.", file=sys.stderr)
            return 1
    if not (ROOT / "node_modules").is_dir() or not (ROOT / "backend/.venv").is_dir():
        print("Run ./scripts/setup-local.sh first.", file=sys.stderr)
        return 1
    env = {**read_env(ROOT / ".env"), **os.environ}
    try:
        backend_port = int(env.get("BACKEND_PORT", "8010"))
        if backend_port < 1024 or backend_port > 65535 or backend_port == 3000:
            raise ValueError
    except ValueError:
        print("BACKEND_PORT must be an integer from 1024 to 65535, other than frontend port 3000.", file=sys.stderr)
        return 1
    busy = [str(port) for port in (3000, backend_port) if not port_available(port)]
    if busy:
        print(f"Ports {', '.join(busy)} are already in use. Stop the previous local run first.", file=sys.stderr)
        return 1
    # Loopback binding is intentional: local auth is a single-user mode.
    env.setdefault("API_INTERNAL_URL", f"http://127.0.0.1:{backend_port}")
    children = []
    stopping = False

    def stop(_signal=None, _frame=None):
        nonlocal stopping
        stopping = True
        for child in children:
            if child.poll() is None:
                try:
                    os.killpg(child.pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass

    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)
    try:
        children.append(subprocess.Popen(
            ["uv", "run", "--no-sync", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(backend_port)],
            cwd=ROOT / "backend", env=env, start_new_session=True,
        ))
        children.append(subprocess.Popen(
            ["npm", "run", "dev"], cwd=ROOT, env=env, start_new_session=True,
        ))
        print("Finder-Keeper: http://127.0.0.1:3000", flush=True)
        print("Library: backend/.data. First launch may download the local embedding model.", flush=True)
        print("Press Ctrl+C to stop both services.", flush=True)
        while not stopping:
            for child in children:
                result = child.poll()
                if result is not None:
                    print(f"A local service exited ({result}); stopping this run.", file=sys.stderr)
                    return result or 1
            time.sleep(0.25)
    finally:
        stop()
        deadline = time.monotonic() + 10
        for child in children:
            try:
                child.wait(timeout=max(0.1, deadline - time.monotonic()))
            except subprocess.TimeoutExpired:
                try:
                    os.killpg(child.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                child.wait()
    return 0


if __name__ == "__main__":
    sys.exit(main())
