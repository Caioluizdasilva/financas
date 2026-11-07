// Carrega o app.js dentro do Node para testar os cálculos, sem navegador.
//
// O app.js é um único bloco fechado `(()=>{ ... })();`. Para não expor nada no
// app publicado, este carregador injeta — só na cópia em memória usada pelos
// testes — uma linha no fim do bloco que entrega as funções internas.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ROOT = new URL('../../', import.meta.url);
const EXPORTS = [
  'calc', 'M', 'cashMonthData', 'valid', 'normalize', 'investmentTax', 'investmentProjection', 'investmentBalance',
  'easterSunday', 'brazilHoliday', 'businessDay', 'nextBusinessDay', 'lastBusinessDay', 'nthBusinessDay',
  'fifthBusinessDay', 'subscriptionDueDate', 'rowDueDate', 'debtDueDate', 'parseCsvLine', 'parseStatementAmount',
  'statementTotals', 'generateInstallments', 'generateDebtInstallments', 'goalTarget', 'goalSaved',
];

// Objeto "coringa": aceita qualquer acesso/chamada sem quebrar. Basta para o
// código de interface que roda ao carregar o arquivo; os cálculos não usam o DOM.
function anything() {
  const fn = function () {};
  return new Proxy(fn, {
    get(target, prop) {
      if (prop === Symbol.toPrimitive) return () => '';
      if (prop === 'then') return undefined;
      if (prop === 'length') return 0;
      if (prop === 'classList') return { add() {}, remove() {}, toggle() {}, contains: () => false };
      if (prop === 'style') return { setProperty() {} };
      if (prop === 'dataset') return {};
      return anything();
    },
    apply: () => anything(),
    set: () => true,
  });
}

export function loadApp({ inputs = {} } = {}) {
  let src = readFileSync(new URL('app.js', ROOT), 'utf8');
  const end = src.lastIndexOf('})();');
  if (end < 0) throw new Error('fim do bloco do app.js não encontrado');
  const hook = `;globalThis.__app={${EXPORTS.join(',')},getState:()=>S,setState:x=>{S=x},setRates:r=>{investmentRates=r}};`;
  src = src.slice(0, end) + hook + src.slice(end);

  const alerts = [];
  const own = {
    querySelector: sel => (sel in inputs ? { value: inputs[sel] } : sel.startsWith('#inv-') ? null : anything()),
    querySelectorAll: () => [],
    getElementById: () => null,
  };
  const document = new Proxy(own, { get: (t, p) => (p in t ? t[p] : anything()), set: (t, p, v) => { t[p] = v; return true; } });
  const storage = new Map();
  const window = {
    SEED: JSON.parse(readFileSync(new URL('seed.js', ROOT), 'utf8').replace(/^window\.SEED=/, '').replace(/;\s*$/, '')),
    matchMedia: () => ({ matches: true, addEventListener() {} }),
    addEventListener() {},
    FinancasCloud: undefined,
  };
  const context = {
    window, document, console, Date, Math, JSON, Intl, Number, String, Array, Object, Set, Map, RegExp, Promise,
    navigator: { onLine: true },
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    alert: msg => alerts.push(msg), confirm: () => true,
    setTimeout: () => 0, clearTimeout() {}, requestAnimationFrame() {},
    fetch: async () => { throw new Error('sem rede nos testes'); },
    location: { reload() {} }, CSS: { escape: s => s },
  };
  context.globalThis = context;
  window.document = document;
  vm.createContext(context);
  vm.runInContext(src, context, { filename: 'app.js' });
  const app = context.__app;
  app.alerts = alerts;
  return app;
}

export function fixture() {
  return JSON.parse(readFileSync(new URL('tests/fixtures/state.json', ROOT), 'utf8'));
}

// Carrega o app já com os dados de exemplo normalizados.
export function appWithFixture(options) {
  const app = loadApp(options);
  app.setState(app.normalize(fixture()));
  return app;
}
