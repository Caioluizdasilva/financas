"""Utilitários de teste no navegador para o Finanças (uso local, não roda no CI).

Sobe um servidor estático para uma pasta do app, troca a biblioteca do Supabase
pelo tests/mock-supabase.js, carrega os dados de tests/fixtures/state.json na
"nuvem" simulada e congela relógio, rede externa e animações para que as
capturas de tela sejam reproduzíveis.

Requer: pip install playwright && playwright install chromium (ou Chrome local).
"""
import functools
import http.server
import json
import pathlib
import threading
from contextlib import contextmanager

from playwright.sync_api import sync_playwright

TESTS = pathlib.Path(__file__).resolve().parent.parent
MOCK = (TESTS / 'mock-supabase.js').read_text()
FIXTURE = json.loads((TESTS / 'fixtures' / 'state.json').read_text())
FONTS = TESTS.parent / 'assets' / 'fonts' / 'poppins'
FIXED_TIME = '2026-11-06T15:00:00-03:00'
BCB = {'432': [{'data': '05/11/2026', 'valor': '15.00'}],
       '4389': [{'data': '05/11/2026', 'valor': '14.90'}],
       '433': [{'data': '01/10/2026', 'valor': '0.48'}]}
FREEZE_CSS = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'


def google_fonts_css(base):
    rules = []
    for w in (300, 400, 500, 600, 700, 800):
        rules.append("@font-face{font-family:'Poppins';font-style:normal;font-weight:%d;font-display:block;"
                     "src:url(%s/__fonts/poppins-latin-%d-normal.woff2) format('woff2')}" % (w, base, w))
    return '\n'.join(rules)


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


@contextmanager
def serve(root, port):
    handler = functools.partial(QuietHandler, directory=str(root))
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', port), handler)
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    try:
        yield f'http://127.0.0.1:{port}'
    finally:
        httpd.shutdown()


def install_routes(context, base):
    def handle(route):
        url = route.request.url
        if '/vendor/supabase-js' in url:
            return route.fulfill(status=200, content_type='application/javascript', body=MOCK)
        if url.startswith('https://fonts.googleapis.com/'):
            return route.fulfill(status=200, content_type='text/css', body=google_fonts_css(base))
        if '/__fonts/' in url:
            name = url.rsplit('/', 1)[-1]
            return route.fulfill(status=200, content_type='font/woff2', body=(FONTS / name).read_bytes())
        if url.startswith('https://api.bcb.gov.br/'):
            code = url.split('bcdata.sgs.')[1].split('/')[0]
            return route.fulfill(status=200, content_type='application/json', body=json.dumps(BCB.get(code, [])))
        if url.startswith('https://cdn.jsdelivr.net/npm/@supabase'):
            return route.fulfill(status=200, content_type='application/javascript', body=MOCK)
        if url.startswith(base):
            return route.continue_()
        return route.abort()
    context.route('**/*', handle)


@contextmanager
def browser():
    with sync_playwright() as p:
        args = ['--font-render-hinting=none', '--disable-lcd-text']
        try:
            b = p.chromium.launch(channel='chrome', args=args)
        except Exception:  # sem Google Chrome instalado: usa o Chromium do Playwright
            b = p.chromium.launch(args=args)
        try:
            yield b
        finally:
            b.close()


def new_context(b, base, width=1440, height=900, dark=True, state=None, role='common', logged_in=True, mobile=False):
    context = b.new_context(viewport={'width': width, 'height': height}, device_scale_factor=1,
                            color_scheme='dark' if dark else 'light', service_workers='block',
                            is_mobile=mobile, has_touch=mobile, locale='pt-BR', timezone_id='America/Sao_Paulo')
    install_routes(context, base)
    seed = json.loads(json.dumps(state if state is not None else FIXTURE))
    seed.setdefault('preferences', {})['theme'] = 'dark' if dark else 'light'
    cloud = {'user_data': {'00000000-0000-4000-8000-000000000001': {'state': seed, 'updated_at': '2026-11-06T12:00:00.000Z'}}, 'profiles': {}}
    init = ("if(!localStorage.getItem('__mock_cloud')){"
            "localStorage.setItem('__mock_cloud',%s);localStorage.setItem('__mock_role',%s);"
            "%s}"
            "document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent=%s;document.head.appendChild(s)});") % (
        json.dumps(json.dumps(cloud)), json.dumps(role),
        "localStorage.removeItem('__mock_logged_out');" if logged_in else "localStorage.setItem('__mock_logged_out','1');",
        json.dumps(FREEZE_CSS))
    context.add_init_script(init)
    return context


def open_app(context, base):
    page = context.new_page()
    page.clock.install(time=FIXED_TIME)
    page.clock.resume()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(base + '/index.html')
    page.evaluate('document.fonts.ready')
    page.__errors = errors
    return page
