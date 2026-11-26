"""Hardware-path self-check without a real IBM key: a fake 127-qubit device (FakeSherbrooke) is injected
into the SAME pipeline code the real path uses. Also proves the user's API key never leaks.
Run: python quantum/test_hardware.py"""
import json
import threading
import time
import urllib.request
from http.server import ThreadingHTTPServer

import pipeline
import server
from qiskit_ibm_runtime.fake_provider import FakeSherbrooke

BELL = "qc = QuantumCircuit(2)\nqc.h(0)\nqc.cx(0, 1)"
SECRET = "SECRETKEY_abcdefghijklmnopqrstuvwxyz0123456789"

# 1. pipeline: hardware path with an injected backend
stages = []
pipeline.run(BELL, 1, 512, "ibm", stages.append, lambda s: None, backend=FakeSherbrooke())
ids = [s["id"] for s in stages]
assert ids == ["build", "decompose", "optimize", "transpile", "execute", "post", "report"], ids
post, rep = stages[-2], stages[-1]
assert post["tvdModel"] is not None and all("model" in h for h in post["histogram"])
assert rep["backend"] == "fake_sherbrooke" and rep["noise_model_counts"] and rep["hardware_counts"]
assert rep["transpiled"]["depth"] >= rep["logical"]["depth"]
assert stages[4]["hardware"] is True and {"k": "dd"} in stages[4]["chips"]
print("ok pipeline: 7 stages, hardware vs noise model tvd", post["tvd"], "/", post["tvdModel"])

# 2. server: bad input paths and key handling
httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{httpd.server_port}"


def call(path, body=None):
    req = urllib.request.Request(base + path, data=json.dumps(body).encode() if body is not None else None)
    try:
        r = urllib.request.urlopen(req)
        return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


assert call("/api/run", {"code": BELL, "backend": "ibm"}) == (400, {"error": {"k": "needKey"}})
assert call("/api/run", {"code": BELL, "backend": "ibm", "apiKey": "short"}) == (400, {"error": {"k": "badKey"}})
assert call("/api/run", {"code": BELL, "backend": "ibm", "apiKey": "has spaces in it, definitely not valid"})[0] == 400
assert call("/api/health")[1]["hardware"] is True

# a well-formed but wrong key must fail with a translatable error and never echo the key anywhere
orig = pipeline.QiskitRuntimeService if hasattr(pipeline, "QiskitRuntimeService") else None
code, resp = call("/api/run", {"code": BELL, "backend": "ibm", "apiKey": SECRET})
assert code == 200
jid = resp["id"]
for _ in range(60):
    c, job = call(f"/api/jobs/{jid}")
    if job["status"] != "running":
        break
    time.sleep(0.5)
assert job["status"] == "error" and job["error"]["k"] in ("badKey", "raw"), job
assert SECRET not in json.dumps(job), "api key leaked into the job record"
assert SECRET not in json.dumps(server.JOBS), "api key leaked into the job store"
print("ok server: needKey/badKey rejected, wrong key -> keyed error, key absent from job store")
httpd.shutdown()
