"""HTTP API for the Code tab. Runs the Qiskit lifecycle server-side; the browser never sees the IBM key.

Run: python quantum/server.py        (127.0.0.1:8000; set HOST/PORT to change)
Hardware is OFF unless ENABLE_HARDWARE=1 and QUANTUM_API_KEY are set, and only one hardware job runs at a time.
"""
import json
import os
import threading
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from dotenv import load_dotenv

import pipeline
from sandbox import SandboxError

load_dotenv()
JOBS, MAX_JOBS, MAX_BODY = {}, 50, 20000
HW = threading.Lock()


def hardware_enabled():
    return os.getenv("ENABLE_HARDWARE") == "1" and bool(os.getenv("QUANTUM_API_KEY"))


def work(job, p, hw):
    try:
        pipeline.run(p["code"], p["level"], p["shots"], p["backend"], job["stages"].append, lambda s: job.update(status=s))
        job["status"] = "done"
    except Exception as e:
        msg = str(e) if isinstance(e, SandboxError) else f"{type(e).__name__}: {e}"
        key = os.getenv("QUANTUM_API_KEY")
        job.update(status="error", error=(msg.replace(key, "***") if key else msg)[:600])
    finally:
        if hw:
            HW.release()


class Handler(BaseHTTPRequestHandler):
    def send(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/api/health":
            return self.send(200, {"hardware": hardware_enabled()})
        job = JOBS.get(self.path.removeprefix("/api/jobs/")) if self.path.startswith("/api/jobs/") else None
        if job is None:
            return self.send(404, {"error": "not found"})
        self.send(200, {**job, "stages": list(job["stages"])})

    def do_POST(self):
        if self.path != "/api/run":
            return self.send(404, {"error": "not found"})
        n = int(self.headers.get("Content-Length") or 0)
        if n > MAX_BODY:
            return self.send(413, {"error": "request too large"})
        try:
            p = json.loads(self.rfile.read(n))
            p = {"code": p["code"], "level": int(p.get("level", 1)), "shots": int(p.get("shots", 1024)), "backend": p.get("backend", "sim")}
            assert isinstance(p["code"], str) and len(p["code"]) <= 6000
            assert p["level"] in range(4) and 1 <= p["shots"] <= 4096 and p["backend"] in ("sim", "ibm")
        except Exception:
            return self.send(400, {"error": "invalid request: code (<=6000 chars), level 0-3, shots 1-4096, backend sim|ibm"})
        hw = p["backend"] == "ibm"
        if hw and not hardware_enabled():
            return self.send(403, {"error": "IBM hardware is not enabled on this server"})
        if hw and not HW.acquire(blocking=False):
            return self.send(429, {"error": "a hardware job is already running, try again in a few minutes"})
        jid = uuid.uuid4().hex[:12]
        JOBS[jid] = job = {"status": "running", "stages": [], "error": None, "hardware": hw}
        while len(JOBS) > MAX_JOBS:
            JOBS.pop(next(iter(JOBS)))
        threading.Thread(target=work, args=(job, p, hw), daemon=True).start()
        self.send(200, {"id": jid})


if __name__ == "__main__":
    host, port = os.getenv("HOST", "127.0.0.1"), int(os.getenv("PORT", "8000"))
    print(f"Qiskit API on http://{host}:{port}  (hardware: {'on' if hardware_enabled() else 'off'})")
    ThreadingHTTPServer((host, port), Handler).serve_forever()
