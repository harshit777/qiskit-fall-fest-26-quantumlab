"""HTTP API for the Code tab. Runs the Qiskit lifecycle server-side; the browser only talks to the /api proxy.

Run: python quantum/server.py        (127.0.0.1:8000; set HOST/PORT to change)

IBM hardware: the caller sends their own IBM Quantum API key with the request. The key is used for that one
run only. It is never stored, never put in the job record, never logged, and scrubbed from any error text.
If the server has QUANTUM_API_KEY set and ENABLE_HARDWARE=1 (your own deployment), callers may omit the key.
Concurrency is capped (1 hardware job, MAX_SIM_JOBS simulator jobs, default 2); extra requests get HTTP 429.
"""
import json
import os
import re
import threading
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from dotenv import load_dotenv

import pipeline
from pipeline import PipelineError
from sandbox import SandboxError

load_dotenv()
JOBS, MAX_JOBS, MAX_BODY = {}, 50, 20000
HW = threading.BoundedSemaphore(1)
SIM = threading.BoundedSemaphore(int(os.getenv("MAX_SIM_JOBS", "2")))
KEY_OK = re.compile(r"[A-Za-z0-9_\-]{20,200}")  # IBM keys are ~44 url-safe characters


def server_key():
    return os.getenv("QUANTUM_API_KEY") if os.getenv("ENABLE_HARDWARE") == "1" else None


def work(job, p, gate):
    secret = p.pop("api_key", None)
    scrub = lambda m: m.replace(secret, "***") if secret else m
    try:
        pipeline.run(p["code"], p["level"], p["shots"], p["backend"], job["stages"].append,
                     lambda s: job.update(phase=s), api_key=secret)
        job["status"] = "done"
    except PipelineError as e:
        job.update(status="error", error={"k": e.key, "v": e.params})
    except SandboxError as e:
        job.update(status="error", error={"k": "raw", "v": scrub(str(e))[:600]})
    except Exception as e:
        job.update(status="error", error={"k": "raw", "v": scrub(f"{type(e).__name__}: {e}")[:600]})
    finally:
        secret = None
        gate.release()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):  # default logger prints request lines only, but keep the key path silent
        pass

    def send(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/api/health":
            return self.send(200, {"hardware": True, "serverKey": bool(server_key())})
        job = JOBS.get(self.path.removeprefix("/api/jobs/")) if self.path.startswith("/api/jobs/") else None
        if job is None:
            return self.send(404, {"error": "not found"})
        self.send(200, {**job, "stages": list(job["stages"])})

    def do_POST(self):
        if self.path != "/api/run":
            return self.send(404, {"error": "not found"})
        n = int(self.headers.get("Content-Length") or 0)
        if n > MAX_BODY:
            return self.send(413, {"error": {"k": "tooLarge"}})
        try:
            p = json.loads(self.rfile.read(n))
            key = (p.get("apiKey") or "").strip()
            p = {"code": p["code"], "level": int(p.get("level", 1)), "shots": int(p.get("shots", 1024)), "backend": p.get("backend", "sim"), "api_key": key}
            assert isinstance(p["code"], str) and len(p["code"]) <= 6000
            assert p["level"] in range(4) and 1 <= p["shots"] <= 4096 and p["backend"] in ("sim", "ibm")
        except Exception:
            return self.send(400, {"error": {"k": "invalid"}})
        hw = p["backend"] == "ibm"
        if hw:
            p["api_key"] = p["api_key"] or server_key() or ""
            if not p["api_key"]:
                return self.send(400, {"error": {"k": "needKey"}})
            if not KEY_OK.fullmatch(p["api_key"]):
                return self.send(400, {"error": {"k": "badKey"}})
        else:
            p["api_key"] = ""
        gate = HW if hw else SIM
        if not gate.acquire(blocking=False):
            return self.send(429, {"error": {"k": "busyHw" if hw else "busy"}})
        jid = uuid.uuid4().hex[:12]
        JOBS[jid] = job = {"status": "running", "phase": None, "stages": [], "error": None, "hardware": hw}
        while len(JOBS) > MAX_JOBS:
            JOBS.pop(next(iter(JOBS)))
        threading.Thread(target=work, args=(job, p, gate), daemon=True).start()
        self.send(200, {"id": jid})


if __name__ == "__main__":
    host, port = os.getenv("HOST", "127.0.0.1"), int(os.getenv("PORT", "8000"))
    print(f"Qiskit API on http://{host}:{port}  (server IBM key: {'yes' if server_key() else 'no, callers bring their own'})")
    ThreadingHTTPServer((host, port), Handler).serve_forever()
