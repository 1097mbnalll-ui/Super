#!/usr/bin/env python3
"""يشغّل أمر بمهلة، ويطبع ناتجه لحظياً (عشان سجل Codemagic ما يضيع لو علّق). الاستخدام: run_limited.py <ثواني> <أمر...>"""
import subprocess, sys, threading, time
limit = int(sys.argv[1]); cmd = sys.argv[2:]
p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
t0 = time.time()
def pump():
    for line in p.stdout: print(line, end="", flush=True)
th = threading.Thread(target=pump, daemon=True); th.start()
while p.poll() is None and time.time() - t0 < limit: time.sleep(1)
if p.poll() is None:
    print("\nTIMEOUT after %ds: killing" % limit, flush=True); p.kill(); th.join(5); sys.exit(124)
th.join(5); sys.exit(p.returncode)
