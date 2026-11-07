"""Testes da sincronização com a nuvem (uso local, com navegador).

Duas abas do mesmo navegador compartilham a "nuvem" simulada, então funcionam
como dois aparelhos da mesma conta.

Uso: python3 tests/sync/sync_test.py
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tests' / 'visual'))
from harness import browser, new_context, open_app, serve  # noqa: E402

UID = '00000000-0000-4000-8000-000000000001'
failures = []


def check(cond, msg):
    print(('  ok  ' if cond else '  FALHOU  ') + msg)
    if not cond:
        failures.append(msg)


def cloud(page):
    return page.evaluate("uid=>JSON.parse(localStorage.getItem('__mock_cloud')).user_data[uid]", UID)


def ready(page):
    page.wait_for_selector('.app-shell .nav-item', timeout=20000)
    page.wait_for_timeout(200)


def edit(page, name):
    """Simula uma edição: muda o apelido e dispara o salvamento como o app faz."""
    page.evaluate("n=>{window.FinancasBridge.getState().profile.chamado=n;window.FinancasCloud.schedule(window.FinancasBridge.getState())}", name)


def wait_saved(page, ms=1500):
    page.wait_for_timeout(ms)


def visible(page):
    page.evaluate("()=>{Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});document.dispatchEvent(new Event('visibilitychange'))}")


def conflict_open(page):
    return page.evaluate("()=>!!document.querySelector('#finance-sync-conflict[open]')")


def main():
    with serve(ROOT, 8170) as base, browser() as b:
        print('1. Salvamento normal')
        ctx = new_context(b, base)
        a = open_app(ctx, base); ready(a)
        v0 = cloud(a)['updated_at']
        edit(a, 'Ana A'); wait_saved(a)
        row = cloud(a)
        check(row['state']['profile']['chamado'] == 'Ana A', 'a edição chegou à nuvem')
        check(row['updated_at'] != v0, 'a versão na nuvem mudou')
        check('Salvo na nuvem' in a.inner_text('#saved'), 'o aviso "Salvo na nuvem" aparece')

        print('2. Conflito entre dois aparelhos — usar a versão da nuvem')
        bb = open_app(ctx, base); ready(bb)
        edit(a, 'Editado no A'); wait_saved(a)
        edit(bb, 'Editado no B'); wait_saved(bb)
        check(cloud(a)['state']['profile']['chamado'] == 'Editado no A', 'o aparelho B NÃO sobrescreveu o que o A salvou')
        check(conflict_open(bb), 'o aparelho B mostra o aviso de conflito')
        bb.click('[data-sync-cloud]'); bb.wait_for_timeout(400)
        check(not conflict_open(bb), 'o aviso fecha')
        check(bb.evaluate("()=>window.FinancasBridge.getState().profile.chamado") == 'Editado no A', 'B passa a mostrar os dados do A')
        edit(bb, 'B depois do conflito'); wait_saved(bb)
        check(cloud(a)['state']['profile']['chamado'] == 'B depois do conflito', 'B volta a salvar normalmente')
        ctx.close()

        print('3. Conflito — manter as alterações deste aparelho')
        ctx = new_context(b, base)
        a = open_app(ctx, base); ready(a)
        bb = open_app(ctx, base); ready(bb)
        edit(a, 'Do A'); wait_saved(a)
        edit(bb, 'Do B'); wait_saved(bb)
        check(conflict_open(bb), 'conflito detectado')
        bb.click('[data-sync-local]'); wait_saved(bb)
        check(cloud(a)['state']['profile']['chamado'] == 'Do B', 'a versão do B foi gravada por escolha do usuário')
        edit(a, 'A de novo'); wait_saved(a)
        check(conflict_open(a), 'o A, agora desatualizado, também é avisado em vez de sobrescrever')
        ctx.close()

        print('4. Voltar para a aba atualiza os dados automaticamente')
        ctx = new_context(b, base)
        a = open_app(ctx, base); ready(a)
        bb = open_app(ctx, base); ready(bb)
        edit(a, 'Atualizado no A'); wait_saved(a)
        visible(bb); bb.wait_for_timeout(600)
        check(bb.evaluate("()=>window.FinancasBridge.getState().profile.chamado") == 'Atualizado no A', 'B carregou os dados novos ao voltar para a aba')
        check(not conflict_open(bb), 'sem conflito quando B não tinha alterações')
        edit(bb, 'B após atualizar'); wait_saved(bb)
        check(cloud(a)['state']['profile']['chamado'] == 'B após atualizar', 'B salva normalmente depois de atualizar')
        ctx.close()

        print('5. Sem internet')
        ctx = new_context(b, base)
        a = open_app(ctx, base); ready(a)
        ctx.set_offline(True)
        a.evaluate("()=>localStorage.setItem('__mock_offline','1')")
        edit(a, 'Feito offline'); wait_saved(a)
        check(cloud(a)['state']['profile']['chamado'] != 'Feito offline', 'nada é gravado sem conexão')
        check('Sem conexão' in a.inner_text('#saved') or 'Falha' in a.inner_text('#saved'), 'o aviso de pendência aparece')
        a.evaluate("()=>localStorage.removeItem('__mock_offline')")
        ctx.set_offline(False)
        a.wait_for_timeout(1500)
        check(cloud(a)['state']['profile']['chamado'] == 'Feito offline', 'a alteração é enviada quando a conexão volta')
        ctx.close()

        print('6. Edições durante um salvamento em andamento não se perdem')
        ctx = new_context(b, base)
        a = open_app(ctx, base); ready(a)
        a.evaluate("()=>localStorage.setItem('__mock_delay','700')")
        edit(a, 'Primeira'); a.wait_for_timeout(650)  # salvamento em andamento
        edit(a, 'Segunda'); a.wait_for_timeout(3000)
        check(cloud(a)['state']['profile']['chamado'] == 'Segunda', 'a última edição foi salva')
        ctx.close()

        print('7. Abrir o app sem conexão mostra um aviso e entra sozinho quando a conexão volta')
        ctx = new_context(b, base)
        ctx.add_init_script("localStorage.setItem('__mock_offline','1')")
        a = ctx.new_page()
        a.goto(base + '/index.html'); a.wait_for_timeout(1500)
        txt = a.inner_text('#auth-screen') if a.query_selector('#auth-screen') else ''
        check('sem conexão' in txt.lower(), 'a tela mostra o aviso de falta de conexão')
        a.evaluate("()=>{localStorage.removeItem('__mock_offline');window.dispatchEvent(new Event('online'))}")
        a.wait_for_selector('.app-shell .nav-item', timeout=10000)
        check(not a.query_selector('#auth-screen'), 'o app entra sozinho quando a conexão volta')
        ctx.close()

        print('8. Com o service worker, o app abre sem internet')
        ctx = b.new_context(viewport={'width': 1200, 'height': 800}, service_workers='allow')
        a = ctx.new_page()
        a.goto(base + '/index.html')
        a.wait_for_function("()=>navigator.serviceWorker && navigator.serviceWorker.controller || (navigator.serviceWorker.ready.then(()=>location.reload()), false)", timeout=20000)
        a.wait_for_timeout(1500)
        ctx.set_offline(True)
        a.reload(); a.wait_for_timeout(1500)
        check(a.evaluate("()=>!!window.supabase?.createClient"), 'a biblioteca do Supabase carrega do cache')
        check(a.query_selector('#auth-screen') is not None, 'a tela de acesso aparece (em vez de página de erro)')
        check(a.evaluate("()=>document.fonts.check('600 16px Poppins')"), 'a fonte Poppins carrega do cache')
        ctx.close()

    print()
    if failures:
        print(f'{len(failures)} verificação(ões) falharam')
        sys.exit(1)
    print('Todas as verificações passaram')


if __name__ == '__main__':
    main()
