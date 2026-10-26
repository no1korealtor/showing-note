import http.server
import socketserver
import socket
import webbrowser
import os
import sys

PORT = 8088

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    local_ip = get_local_ip()
    url = f"http://{local_ip}:{PORT}/"
    connect_url = f"http://{local_ip}:{PORT}/connect.html"

    print("=" * 60)
    print(" [중개사 현장 쇼잉 수첩 - 모바일 연결 서버 시작됨]")
    print(f" ▶ 스마트폰 브라우저 접속 주소: {url}")
    print(f" ▶ QR 안내창: {connect_url}")
    print(" (종료하시려면 이 까만 창을 닫으시면 됩니다)")
    print("=" * 60)

    # Open PC browser with QR code helper
    try:
        webbrowser.open(connect_url)
    except Exception:
        pass

    Handler = http.server.SimpleHTTPRequestHandler
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n서버가 종료되었습니다.")

if __name__ == '__main__':
    main()
