"""Consolida style.css sem alterar o resultado da cascata.

Uso: python3 scripts/consolidar-css.py style.css saida.css [--fonts] [--prune .]
Requer: pip install tinycss2 playwright. Sempre confira o resultado com
tests/visual/shoot.py e tests/visual/compare.py antes de usar.

Etapas (todas conservadoras):
 1. Remove declarações mortas: uma declaração é morta se uma regra POSTERIOR com
    exatamente o mesmo seletor, num contexto (@media/@supports) que a cobre,
    define a mesma propriedade (ou um atalho que a reinicia) com importância >=.
    O Chrome valida a regra/declaração posterior; fallbacks com recursos novos
    (color-mix, dvh...) são mantidos.
 2. Move declarações restantes para a última regra do mesmo seletor/contexto
    quando nenhuma regra intermediária (de qualquer seletor) toca a mesma família
    de propriedades — assim a ordem efetiva da cascata não muda.
 3. Remove regras vazias e @keyframes redefinidos depois.
 4. (opcional) Remove regras cujos seletores usam apenas classes/ids que não
    existem em nenhum lugar do HTML/JS.
 5. Formata o arquivo de forma legível, agrupando @media adjacentes iguais.
"""
import json
import os
import re
import sys
OFF = set(os.environ.get('CSSOPT_OFF', '').split(','))

import tinycss2
from playwright.sync_api import sync_playwright

SHORTHANDS = {
    'background': ['background-color', 'background-image', 'background-position', 'background-size', 'background-repeat',
                   'background-attachment', 'background-origin', 'background-clip', 'background-position-x', 'background-position-y'],
    'margin': ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'],
    'padding': ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
    'inset': ['top', 'right', 'bottom', 'left'],
    'border': ['border-width', 'border-style', 'border-color', 'border-top', 'border-right', 'border-bottom', 'border-left',
               'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
               'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
               'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'border-image'],
    'border-color': ['border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color'],
    'border-width': ['border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'],
    'border-style': ['border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style'],
    'border-radius': ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius'],
    'gap': ['row-gap', 'column-gap'],
    'overflow': ['overflow-x', 'overflow-y'],
    'flex': ['flex-grow', 'flex-shrink', 'flex-basis'],
    'transition': ['transition-property', 'transition-duration', 'transition-timing-function', 'transition-delay'],
    'animation': ['animation-name', 'animation-duration', 'animation-timing-function', 'animation-delay',
                  'animation-iteration-count', 'animation-direction', 'animation-fill-mode', 'animation-play-state'],
    'outline': ['outline-color', 'outline-style', 'outline-width'],
    'font': ['font-style', 'font-variant', 'font-weight', 'font-stretch', 'font-size', 'line-height', 'font-family'],
    'place-items': ['align-items', 'justify-items'],
    'place-content': ['align-content', 'justify-content'],
    'place-self': ['align-self', 'justify-self'],
    'flex-flow': ['flex-direction', 'flex-wrap'],
    'list-style': ['list-style-type', 'list-style-position', 'list-style-image'],
    'text-decoration': ['text-decoration-line', 'text-decoration-color', 'text-decoration-style', 'text-decoration-thickness'],
    'grid-template': ['grid-template-rows', 'grid-template-columns', 'grid-template-areas'],
    'grid-area': ['grid-row-start', 'grid-column-start', 'grid-row-end', 'grid-column-end'],
    'grid-row': ['grid-row-start', 'grid-row-end'],
    'grid-column': ['grid-column-start', 'grid-column-end'],
    'columns': ['column-width', 'column-count'],
    'mask': ['mask-image', 'mask-position', 'mask-size', 'mask-repeat'],
}
for side in ('top', 'right', 'bottom', 'left'):
    SHORTHANDS['border-' + side] = [f'border-{side}-width', f'border-{side}-style', f'border-{side}-color']
NEW_FEATURES = ('color-mix(', 'dvh', 'svh', 'lvh', 'dvw', 'svw', 'lvw', 'light-dark(', 'text-wrap', 'field-sizing',
                'anchor', 'calc-size(', 'interpolate-size', 'oklch(', 'oklab(', 'lch(', 'lab(', 'round(', 'mod(', 'rem(',
                'cqw', 'cqh', 'cqi', 'cqb', 'clamp(', 'min(', 'max(', 'inset', 'aspect-ratio', 'backdrop-filter', ':has(')


def resets(later, earlier):
    """A propriedade `later` reinicia completamente `earlier`?"""
    if later == earlier:
        return True
    seen, stack = set(), [later]
    while stack:
        p = stack.pop()
        for q in SHORTHANDS.get(p, []):
            if q == earlier:
                return True
            if q not in seen:
                seen.add(q)
                stack.append(q)
    return False


def family(p):
    """Conjunto de propriedades que interagem com p (atalhos e subpropriedades)."""
    out = {p}
    for sh, longs in SHORTHANDS.items():
        if p == sh or p in longs:
            out.add(sh)
            out.update(longs)
    # fecha uma vez mais (ex.: border-top-color -> border-top -> border)
    for sh, longs in SHORTHANDS.items():
        if out & set(longs) or sh in out:
            out.add(sh)
            out.update(longs)
    if p.startswith('-webkit-') or p.startswith('-moz-'):
        out.add(re.sub(r'^-(webkit|moz)-', '', p))
    return out


def norm_sel(prelude):
    s = tinycss2.serialize(prelude).strip()
    s = re.sub(r'\s+', ' ', s)
    s = re.sub(r'\s*,\s*', ',', s)
    return s


def norm_ctx(prelude):
    return re.sub(r'\s+', ' ', tinycss2.serialize(prelude).strip())


class Rule:
    __slots__ = ('ctx', 'sel', 'decls', 'idx', 'notes')

    def __init__(self, ctx, sel, decls, idx):
        self.ctx, self.sel, self.decls, self.idx, self.notes = ctx, sel, decls, idx, []


class Opaque:
    __slots__ = ('ctx', 'text', 'idx', 'kind', 'name', 'notes')

    def __init__(self, ctx, text, idx, kind='', name=''):
        self.ctx, self.text, self.idx, self.kind, self.name, self.notes = ctx, text, idx, kind, name, []


def parse(css):
    items = []
    pending = []

    def walk(nodes, ctx):
        for n in nodes:
            if n.type == 'comment':
                txt = n.value.strip()
                if txt:
                    pending.append(txt)
                continue
            if n.type == 'whitespace':
                continue
            if n.type == 'qualified-rule':
                decls = []
                for d in tinycss2.parse_blocks_contents(n.content, skip_comments=True, skip_whitespace=True):
                    if d.type != 'declaration':
                        raise SystemExit('item inesperado dentro de regra: ' + d.type)
                    value = tinycss2.serialize(d.value).strip()
                    decls.append([d.lower_name if not d.name.startswith('--') else d.name, value, d.important])
                items.append(Rule(ctx, norm_sel(n.prelude), decls, len(items)))
                items[-1].notes, pending[:] = list(pending), []
            elif n.type == 'at-rule':
                kw = n.lower_at_keyword
                if kw in ('media', 'supports'):
                    walk(tinycss2.parse_rule_list(n.content, skip_comments=False, skip_whitespace=True),
                         ctx + ('@%s %s' % (kw, norm_ctx(n.prelude)),))
                else:
                    name = norm_ctx(n.prelude) if kw == 'keyframes' else ''
                    items.append(Opaque(ctx, n.serialize(), len(items), kw, name))
                    items[-1].notes, pending[:] = list(pending), []
            elif n.type == 'error':
                raise SystemExit('erro de parse: ' + n.message)
    walk(tinycss2.parse_stylesheet(css, skip_comments=False, skip_whitespace=True), ())
    return items


def carry_notes(old, new):
    """Comentários de itens removidos passam para o próximo item que ficou."""
    keep = {id(i) for i in new}
    carry = []
    for it in old:
        if id(it) in keep:
            if carry:
                it.notes = carry + it.notes
                carry = []
        else:
            carry += it.notes
            it.notes = []


def chrome_validate(items):
    sels, decls = set(), set()
    for it in items:
        if isinstance(it, Rule):
            for part in split_list(it.sel):
                sels.add(part)
            for n, v, _ in it.decls:
                if not n.startswith('--'):
                    decls.add((n, v))
    sels, decls = sorted(sels), sorted(decls)
    with sync_playwright() as p:
        b = p.chromium.launch(channel='chrome')
        page = b.new_page()
        page.set_content('<html></html>')
        okS = page.evaluate("l=>l.map(s=>{try{return CSS.supports('selector('+s+')')}catch(e){return false}})", sels)
        okD = page.evaluate("l=>l.map(([n,v])=>{try{return CSS.supports(n,v)}catch(e){return false}})", [list(d) for d in decls])
        b.close()
    return dict(zip(sels, okS)), dict(zip(decls, okD))


def split_list(sel):
    parts, depth, cur, quote = [], 0, '', None
    for ch in sel:
        if quote:
            cur += ch
            if ch == quote:
                quote = None
            continue
        if ch in '"\'':
            quote = ch
        elif ch in '([':
            depth += 1
        elif ch in ')]':
            depth -= 1
        if ch == ',' and depth == 0:
            parts.append(cur.strip())
            cur = ''
        else:
            cur += ch
    parts.append(cur.strip())
    return parts


MQ = re.compile(r'^@media \((max|min)-width:\s*(\d+(?:\.\d+)?)px\)$')


def ctx_covers(later, earlier):
    """A condição `later` é verdadeira sempre que `earlier` for?"""
    if later == earlier:
        return True
    a, b = MQ.match(later), MQ.match(earlier)
    if a and b and a.group(1) == b.group(1) and 'media' not in OFF:
        wa, wb = float(a.group(2)), float(b.group(2))
        return wa >= wb if a.group(1) == 'max' else wa <= wb
    return False


def covers(later_ctx, earlier_ctx):
    if len(later_ctx) > len(earlier_ctx):
        return False
    return all(ctx_covers(l, e) for l, e in zip(later_ctx, earlier_ctx))


def optimize(items, sel_ok, decl_ok, log):
    rule_valid = {}
    for it in items:
        if isinstance(it, Rule):
            rule_valid[it.idx] = all(sel_ok.get(p, False) for p in split_list(it.sel))

    def decl_valid(n, v):
        return n.startswith('--') or decl_ok.get((n, v), False)

    removed = 0
    # 1. declarações mortas (de trás para frente)
    by_sel = {}
    for it in items:
        if isinstance(it, Rule):
            by_sel.setdefault(it.sel, []).append(it)
    for sel, rules in by_sel.items():
        for i, r in enumerate(rules):
            later_rules = [x for x in rules[i:] if rule_valid[x.idx]]
            keep = []
            for di, (n, v, imp) in enumerate(r.decls):
                dead = False
                if 'dead' in OFF:
                    keep.append([n, v, imp])
                    continue
                for lr in later_rules:
                    if not covers(lr.ctx, r.ctx):
                        continue
                    cand = lr.decls[di + 1:] if lr is r else lr.decls
                    for (ln, lv, limp) in cand:
                        if not resets(ln, n) or not decl_valid(ln, lv):
                            continue
                        if imp and not limp:
                            continue
                        if any(f in lv for f in NEW_FEATURES) and not any(f in v for f in NEW_FEATURES):
                            continue
                        if ln.startswith('-webkit-') != n.startswith('-webkit-'):
                            continue
                        dead = True
                        break
                    if dead:
                        break
                if dead:
                    removed += 1
                else:
                    keep.append([n, v, imp])
            r.decls = keep
    log(f'declarações mortas removidas: {removed}')

    # 2. mover declarações para a última regra do mesmo seletor+contexto
    order = [it for it in items]
    pos = {it.idx: k for k, it in enumerate(order)}
    props_at = [set(n for n, _, _ in it.decls) if isinstance(it, Rule) else set() for it in order]
    groups = {}
    for it in order:
        if isinstance(it, Rule):
            groups.setdefault((it.ctx, it.sel), []).append(it)
    moved = 0
    for key, rules in groups.items():
        if len(rules) < 2 or 'move' in OFF:
            continue
        target = rules[-1]
        for r in reversed(rules[:-1]):
            if not rule_valid[r.idx] or not rule_valid[target.idx]:
                continue
            a, z = pos[r.idx], pos[target.idx]
            between = set()
            for k in range(a + 1, z):
                between |= props_at[k]
            stay, go = [], []
            for d in r.decls:
                fam = family(d[0])
                if fam & between:
                    stay.append(d)
                else:
                    go.append(d)
            if go:
                existing = {(n, imp) for n, _, imp in target.decls}
                target.decls = go + target.decls
                props_at[pos[target.idx]] |= {n for n, _, _ in go}
                moved += len(go)
            r.decls = stay
            props_at[a] = {n for n, _, _ in stay}
    log(f'declarações movidas para a última regra do seletor: {moved}')

    # 3. regras vazias e keyframes redefinidos
    last_kf = {}
    for it in items:
        if isinstance(it, Opaque) and it.kind == 'keyframes' and it.ctx == ():
            last_kf[it.name] = it.idx
    out = []
    for it in items:
        if isinstance(it, Rule) and not it.decls:
            continue
        if isinstance(it, Opaque) and it.kind == 'keyframes' and it.ctx == () and last_kf[it.name] != it.idx:
            log(f'@keyframes {it.name} redefinido depois: versão antiga removida')
            continue
        out.append(it)
    carry_notes(items, out)
    if 'merge' not in OFF:
        out = merge_adjacent(out, rule_valid)
    log(f'regras restantes: {sum(isinstance(i, Rule) for i in out)}')
    return out


SAFE_LIST = re.compile(r'::?-(webkit|moz|ms)-|:(-webkit-|-moz-)')


def merge_adjacent(items, rule_valid):
    """Junta regras vizinhas (mesmo contexto): mesmo seletor, ou mesmas declarações."""
    out = []
    for it in items:
        prev = out[-1] if out else None
        if (isinstance(it, Rule) and isinstance(prev, Rule) and prev.ctx == it.ctx and not it.notes
                and rule_valid.get(prev.idx, False) and rule_valid.get(it.idx, False)):
            if prev.sel == it.sel:
                prev.decls = prev.decls + it.decls
                continue
            if prev.decls == it.decls and not SAFE_LIST.search(prev.sel + it.sel):
                prev.sel = prev.sel + ',' + it.sel
                continue
        out.append(it)
    return out


CLASS_RE = re.compile(r'\.(-?[_a-zA-Z][\w-]*)')
ID_RE = re.compile(r'#(-?[_a-zA-Z][\w-]*)')


def prune_unused(items, sources, log):
    blob = '\n'.join(sources)

    def used(tok):
        if tok in blob:
            return True
        # classes montadas por concatenação: 'prefixo-'+x
        parts = tok.split('-')
        for k in range(1, len(parts)):
            pre = '-'.join(parts[:k]) + '-'
            if re.search(re.escape(pre) + r"['\"`]\s*\+|\$\{", blob) and (pre + "'" in blob or pre + '"' in blob or pre + '`' in blob or pre + '${' in blob):
                return True
        return False

    out, dropped = [], 0
    for it in items:
        if isinstance(it, Rule):
            alive = False
            for part in split_list(it.sel):
                toks = CLASS_RE.findall(re.sub(r'\[[^\]]*\]', '', part)) + ID_RE.findall(re.sub(r'\[[^\]]*\]|url\([^)]*\)', '', part))
                if all(used(t) for t in toks):
                    alive = True
                    break
            if not alive:
                dropped += 1
                continue
        out.append(it)
    carry_notes(items, out)
    log(f'regras com seletores inexistentes no HTML/JS removidas: {dropped}')
    return out


def fmt_decl(n, v, imp):
    v = re.sub(r'\s*!important$', '', v)
    return f'{n}: {v}{" !important" if imp else ""};'


def fmt_sel(sel):
    parts = split_list(sel)
    return ',\n'.join(parts)


def emit(items, header=''):
    lines = [header] if header else []
    cur_ctx = ()

    def open_ctx(target):
        nonlocal cur_ctx
        common = 0
        while common < len(cur_ctx) and common < len(target) and cur_ctx[common] == target[common]:
            common += 1
        for _ in range(len(cur_ctx) - common):
            lines.append('  ' * (len(cur_ctx) - 1 - _) + '}')
        for k in range(common, len(target)):
            lines.append('')
            lines.append('  ' * k + target[k] + ' {')
        cur_ctx = target

    for it in items:
        open_ctx(it.ctx)
        ind = '  ' * len(it.ctx)
        if it.notes:
            lines.append('')
            for note in it.notes:
                lines.append(ind + '/* ' + note.replace('*/', '* /') + ' */')
        if isinstance(it, Opaque):
            lines.append('')
            lines.append(ind + it.text.strip())
            continue
        lines.append('')
        sel = fmt_sel(it.sel).replace('\n', '\n' + ind)
        lines.append(ind + sel + ' {')
        for n, v, imp in it.decls:
            lines.append(ind + '  ' + fmt_decl(n, v, imp))
        lines.append(ind + '}')
    open_ctx(())
    return '\n'.join(lines).lstrip('\n') + '\n'


if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    prune = '--prune' in sys.argv
    css = open(src).read()
    header = ''
    m = re.match(r"\s*(@import\s+url\((?:'[^']*'|\"[^\"]*\"|[^)]*)\)[^;]*;)", css)
    if m:
        css = css[m.end():]
    if '--fonts' in sys.argv:
        faces = []
        for w in (300, 400, 500, 600, 700, 800):
            faces.append("@font-face {\n  font-family: 'Poppins';\n  font-style: normal;\n  font-weight: %d;\n  font-display: swap;\n"
                         "  src: url('assets/fonts/poppins/poppins-latin-%d-normal.woff2') format('woff2');\n}" % (w, w))
        header = '\n\n'.join(faces) + '\n'
    elif m:
        header = m.group(1) + '\n'
    items = parse(css)
    logs = []
    log = lambda s: (logs.append(s), print(s))
    log(f'regras originais: {sum(isinstance(i, Rule) for i in items)}, declarações: {sum(len(i.decls) for i in items if isinstance(i, Rule))}')
    sel_ok, decl_ok = chrome_validate(items)
    log(f'seletores inválidos no Chrome: {sum(1 for v in sel_ok.values() if not v)}; declarações inválidas: {sum(1 for v in decl_ok.values() if not v)}')
    items = optimize(items, sel_ok, decl_ok, log)
    if prune:
        root = sys.argv[sys.argv.index('--prune') + 1]
        sources = [open(f'{root}/{f}').read() for f in ('index.html', 'app.js', 'auth.js', 'seed.js')]
        items = prune_unused(items, sources, log)
    log(f'declarações finais: {sum(len(i.decls) for i in items if isinstance(i, Rule))}')
    open(dst, 'w').write(emit(items, header))
