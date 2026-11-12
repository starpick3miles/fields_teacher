"""Static file server for the tests:  python3 tests/serve.py PORT ROOT

`python3 -m http.server` keeps a listen queue of 5. The page loads a dozen scripts at once, so now and then one
request was reset, that script never ran, and the test saw a blank page. This server is the same thing with a
queue of 128 and no caching (so an edited file is always the one served).
"""
import sys, functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def log_message(self, *a): pass

class Server(ThreadingHTTPServer):
    request_queue_size = 128
    daemon_threads = True

if __name__ == '__main__':
    port, root = int(sys.argv[1]), sys.argv[2]
    Server(('', port), functools.partial(Handler, directory=root)).serve_forever()
