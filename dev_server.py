import http.server
import os

port = 8001

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add no-cache headers to every response to prevents files imported in
        # worker.js from caching.
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_GET(self):
        # Ignore annoying favicon request from Chrome.
        if self.path == '/favicon.ico':
            self.send_response(204)
            self.end_headers()
            return

        super().do_GET()

if __name__ == '__main__':
    root_dir = os.path.join(os.path.dirname(__file__), 'docs')
    os.chdir(root_dir)

    server_address = ('', port)
    httpd = http.server.HTTPServer(server_address, CustomHTTPRequestHandler)
    print(f"Serving: http://localhost:{port}...")
    httpd.serve_forever()
