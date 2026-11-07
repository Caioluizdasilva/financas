"""Tira capturas de todas as telas do Finanças.

Uso: python3 tests/visual/shoot.py <pasta-do-app> <pasta-de-saida>

Depois compare duas pastas com tests/visual/compare.py. Serve para confirmar que
uma mudança de CSS não altera o visual.
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from harness import browser, new_context, open_app, serve  # noqa: E402

VIEWS = ['panel', 'calendario', 'planejamento', 'entradas', 'dinheiro', 'receivables', 'bancos', 'cartoes',
         'dividas', 'quitacao', 'assinaturas', 'metas', 'simulador', 'inteligencia', 'projecao',
         'investimentos', 'patrimonio', 'relatorios', 'moto', 'lembretes', 'educacao']
MASTER_VIEWS = ['admin', 'people', 'educacao', 'admin-settings']
LAYOUTS = {
    'desktop': dict(width=1440, height=900),
    'laptop': dict(width=1100, height=800),
    'tablet': dict(width=820, height=1100),
    'mobile': dict(width=390, height=844, mobile=True),
}


def settle(page):
    page.evaluate('document.fonts.ready')
    page.wait_for_timeout(250)


def go(page, view):
    action = 'go-panel' if view == 'panel' else 'go-' + view
    page.evaluate("a=>{const b=document.querySelector('button[data-action=\"'+a+'\"]');if(!b)throw Error('sem '+a);b.click()}", action)
    page.evaluate('window.scrollTo(0,0)')
    settle(page)


def shot(page, out, name, full=True):
    page.screenshot(path=str(out / (name + '.png')), full_page=full, animations='disabled')


def run(root, out):
    out = pathlib.Path(out)
    out.mkdir(parents=True, exist_ok=True)
    errors = []
    with serve(root, 8140) as base, browser() as b:
        for layout, size in LAYOUTS.items():
            for dark in (True, False):
                theme = 'dark' if dark else 'light'
                ctx = new_context(b, base, dark=dark, **size)
                page = open_app(ctx, base)
                page.wait_for_selector('.app-shell .nav-item', timeout=20000)
                settle(page)
                page.evaluate("()=>{const b=[...document.querySelectorAll('button')].find(x=>/Mostrar valores/.test(x.textContent));b&&b.click()}")
                settle(page)
                for view in VIEWS:
                    go(page, view)
                    shot(page, out, f'{layout}-{theme}-{view}')
                # Mês aberto pelo planejamento
                go(page, 'planejamento')
                page.evaluate("()=>{const b=document.querySelector('button[data-action=\"go-month\"]');b&&b.click()}")
                settle(page)
                shot(page, out, f'{layout}-{theme}-mes')
                # Diálogos
                go(page, 'panel')
                for name, js in [
                    ('dialogo-perfil', "document.querySelector('[data-action=\"account-center\"]').click()"),
                    ('dialogo-renda', "document.querySelector('[data-action=\"edit-financial-profile\"]').click()"),
                    ('dialogo-nova-divida', "document.querySelector('button[data-action=\"go-dividas\"]').click();[...document.querySelectorAll('main button')].find(x=>/Nova dívida|Adicionar dívida|Cadastrar dívida/i.test(x.textContent)).click()"),
                ]:
                    try:
                        page.evaluate('()=>{' + js + '}')
                        settle(page)
                        shot(page, out, f'{layout}-{theme}-{name}', full=False)
                    except Exception as e:  # registra mas continua
                        errors.append(f'{layout}-{theme}-{name}: {e}')
                    page.evaluate("()=>document.querySelectorAll('dialog[open]').forEach(d=>{d.close();d.remove()})")
                    settle(page)
                if size.get('mobile'):
                    go(page, 'panel')
                    page.evaluate("()=>document.querySelector('#menu-toggle').click()")
                    settle(page)
                    shot(page, out, f'{layout}-{theme}-menu', full=False)
                errors += [f'{layout}-{theme}: {e}' for e in page.__errors]
                ctx.close()

                # Área master
                ctx = new_context(b, base, dark=dark, role='master', **size)
                page = open_app(ctx, base)
                page.wait_for_selector('.app-shell .nav-item', timeout=20000)
                settle(page)
                for view in MASTER_VIEWS:
                    go(page, view)
                    shot(page, out, f'{layout}-{theme}-master-{view}')
                errors += [f'{layout}-{theme}-master: {e}' for e in page.__errors]
                ctx.close()

            # Tela de entrada (antes do login)
            ctx = new_context(b, base, dark=True, logged_in=False, **size)
            page = open_app(ctx, base)
            page.wait_for_selector('#auth-screen.ready', timeout=20000)
            settle(page)
            shot(page, out, f'{layout}-auth-landing')
            page.evaluate("()=>document.querySelector('[data-auth-mode=\"login\"]').click()")
            settle(page)
            shot(page, out, f'{layout}-auth-login')
            page.evaluate("()=>document.querySelector('[data-auth-mode=\"signup\"]').click()")
            settle(page)
            shot(page, out, f'{layout}-auth-signup')
            errors += [f'{layout}-auth: {e}' for e in page.__errors]
            ctx.close()
    print(f'{len(list(out.glob("*.png")))} capturas em {out}')
    if errors:
        print('Avisos:')
        for e in errors:
            print(' -', e)


if __name__ == '__main__':
    run(sys.argv[1], sys.argv[2])
