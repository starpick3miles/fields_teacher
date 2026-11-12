"""Stand-in shared-storage backend for tests/sync.py (the app's HttpRemote in js/sync.js talks to it).

In memory, one entry per record, same rules as the Firestore adapter: a push overwrites (arrival order), except
`ifAbsent` items, which are stored only when the record does not exist yet.

  GET  /changes?since=N  → {"changes":[{id,v,d,t}], "cursor":N}   records written after cursor N
  POST /push             [{id,v,d,t,ifAbsent}]
  GET  /dump             → {"records":{id:{...}}, "writes":N}      for the test's own checks
  POST /seed             same body as /push; test setup
"""
import json, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

class Store:
    def __init__(self): self.lock=threading.Lock(); self.rec={}; self.seq=0; self.writes=0
    def push(self,items):
        with self.lock:
            for x in items:
                if x.get('ifAbsent') and x['id'] in self.rec: continue
                self.seq+=1; self.writes+=1
                self.rec[x['id']]={'id':x['id'],'v':x.get('v'),'d':bool(x.get('d')),'t':x.get('t',0),'u':self.seq}
    def changes(self,since):
        with self.lock:
            out=sorted([r for r in self.rec.values() if r['u']>since],key=lambda r:r['u'])
            return {'changes':[{k:r[k] for k in ('id','v','d','t')} for r in out],'cursor':self.seq}

def make_server(port):
    store=Store()
    class H(BaseHTTPRequestHandler):
        def log_message(self,*a): pass
        def _send(self,code,body=None):
            self.send_response(code); self.send_header('Access-Control-Allow-Origin','*'); self.send_header('Access-Control-Allow-Headers','content-type')
            self.send_header('Content-Type','application/json'); self.send_header('Cache-Control','no-store'); self.end_headers()
            if body is not None: self.wfile.write(json.dumps(body,ensure_ascii=False).encode('utf8'))
        def do_OPTIONS(self): self._send(204)
        def do_GET(self):
            u=urlparse(self.path)
            if u.path=='/changes': self._send(200,store.changes(int(parse_qs(u.query).get('since',['0'])[0] or 0)))
            elif u.path=='/dump': self._send(200,{'records':store.rec,'writes':store.writes})
            else: self._send(404,{})
        def do_POST(self):
            n=int(self.headers.get('Content-Length','0')); body=json.loads(self.rfile.read(n).decode('utf8') or '[]')
            if self.path in ('/push','/seed'): store.push(body); self._send(200,{'ok':True})
            else: self._send(404,{})
    srv=ThreadingHTTPServer(('127.0.0.1',port),H)
    threading.Thread(target=srv.serve_forever,daemon=True).start()
    return srv,store
