// Testes dos cálculos financeiros do app.js.
// Rodar: node --test tests/unit/
//
// Os valores esperados foram calculados à mão a partir de tests/fixtures/state.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { appWithFixture, loadApp } from './load-app.mjs';

const near = (actual, expected, msg) => assert.ok(Math.abs(actual - expected) < 0.005, `${msg ?? ''} esperado ${expected}, obtido ${actual}`);
// Os objetos vêm de outro contexto do Node; JSON os torna comparáveis.
const plain = x => JSON.parse(JSON.stringify(x));
const ymd = d => [d.getFullYear(), d.getMonth() + 1, d.getDate()].join('-');

test('resumo do mês: entradas, despesas, reservas e saldo (novembro)', () => {
  const app = appWithFixture();
  const r = app.calc('2026-11');
  // salário 5.200 + VR 650 + VA 400 + home office 150
  near(r.entradas, 6400, 'entradas');
  // mercado 498,70 + uber 73,50 + aluguel 1.500 + internet 119,90 + parcela 349
  // + assinaturas lançadas automaticamente (streaming 39,90 + academia 99)
  near(r.gasto, 2680, 'despesas');
  // reserva 300 + aporte na meta 250
  near(r.inv, 550, 'reservas e aportes');
  // 5.200 − 2.680 − 550 (benefícios não entram no saldo em dinheiro)
  near(r.saldo, 1970, 'saldo');
});

test('resumo do mês com entrada extra (outubro)', () => {
  const app = appWithFixture();
  const r = app.calc('2026-10');
  near(r.extras, 800, 'freela entra como extra');
  near(r.gasto, 2751.95, 'despesas');
  near(r.inv, 870, 'reserva 300 + renda fixa 200 + aportes 250 + 120');
  near(r.saldo, 2378.05, 'saldo');
});

test('assinaturas ativas entram uma única vez nas despesas fixas do mês', () => {
  const app = appWithFixture();
  app.M('2026-11');
  app.M('2026-11');
  const fixos = app.getState().months['2026-11'].fixos;
  assert.equal(fixos.filter(r => r.subscriptionId === 's1').length, 1);
  assert.equal(fixos.filter(r => r.subscriptionId === 's2').length, 1);
});

test('gastos com vale-refeição só pesam no saldo no que passar do benefício', () => {
  const app = appWithFixture();
  app.getState().months['2026-11'].gastos.push({ nome: 'Restaurantes', valor: 1200, tipo: 'Alimentação / Refeição', cat: 'Alimentação', pago: true });
  const r = app.calc('2026-11');
  // benefícios de alimentação: 650 + 400 = 1.050 → excedente 150
  near(r.caixaDespesas, 2680 + 150, 'despesas pagas em dinheiro');
  near(r.beneficiosRestantes.alimentacao, 0, 'benefício esgotado');
  near(r.saldo, 5200 - 2830 - 550, 'saldo');
});

test('dinheiro em espécie: saldo do mês anterior passa para o seguinte', () => {
  const app = appWithFixture();
  const S = app.getState();
  S.movements.push({ id: 'c1', nome: 'Saque', valor: 200, data: '2026-10-05', bancoId: '__cash__' });
  S.months['2026-11'].gastos.push({ nome: 'Feira', valor: 50, tipo: 'Dinheiro', cat: 'Alimentação', pago: true });
  const out = app.cashMonthData('2026-10');
  near(out.closing, 200, 'outubro fecha com 200');
  const nov = app.cashMonthData('2026-11');
  near(nov.opening, 200, 'novembro abre com 200');
  near(nov.closing, 150, 'novembro fecha com 150');
});

test('metas: valor guardado soma os aportes de todos os meses', () => {
  const app = appWithFixture();
  const [g1, g2] = app.getState().goals;
  near(app.goalSaved(g1), 750, 'reserva de emergência: 3 × 250');
  near(app.goalTarget(g1), 15000);
  near(app.goalSaved(g2), 120, 'viagem');
});

test('parcelas: gera as parcelas restantes nos meses seguintes, sem duplicar', () => {
  const app = appWithFixture();
  app.generateInstallments('2026-11'); // Notebook 5/10
  const S = app.getState();
  for (const [k, p] of [['2026-12', '6/10'], ['2027-01', '7/10'], ['2027-04', '10/10']]) {
    const row = S.months[k]?.parcelas.find(r => r.parc === p);
    assert.ok(row, `parcela ${p} em ${k}`);
    near(row.valor, 349);
  }
  assert.ok(!S.months['2027-05'], 'não passa da última parcela');
  assert.deepEqual(plain(S.keys), plain(S.keys).sort(), 'meses em ordem');
  app.generateInstallments('2026-11');
  assert.equal(S.months['2026-12'].parcelas.filter(r => r.parc === '6/10').length, 1, 'rodar de novo não duplica');
});

test('validação e normalização dos dados salvos', () => {
  const app = loadApp();
  assert.ok(!app.valid({ keys: [], months: {} }), 'faltando listas obrigatórias');
  const x = app.normalize({
    keys: ['2026-01', '2026-01'], months: { '2026-01': { bonus: 300, gastos: [{ nome: 'x', valor: 10 }] } },
    debts: [{ nome: 'B', valor: -5, prioridade: 1 }, { nome: 'A', valor: 100, inicial: 50, prioridade: 0 }],
    cats: [], tipos: [],
  });
  assert.deepEqual(plain(x.keys), ['2026-01'], 'meses repetidos removidos');
  const m = x.months['2026-01'];
  assert.equal(m.bonus, 0, 'bônus antigo migrado');
  assert.equal(m.bonusItems[0].valor, 300);
  assert.equal(m.gastos[0].pago, true, 'gastos antigos marcados como pagos');
  assert.deepEqual(plain(x.debts.map(d => d.nome)), ['A', 'B'], 'dívidas ordenadas por prioridade');
  assert.equal(x.debts[0].inicial, 100, 'valor original nunca menor que o saldo');
  assert.equal(x.debts[1].valor, 0, 'saldo negativo vira zero');
  assert.ok(app.valid(x));
});

test('imposto de renda regressivo dos investimentos', () => {
  const app = loadApp();
  assert.equal(app.investmentTax(1), 0.225);
  assert.equal(app.investmentTax(180), 0.225);
  assert.equal(app.investmentTax(181), 0.2);
  assert.equal(app.investmentTax(360), 0.2);
  assert.equal(app.investmentTax(361), 0.175);
  assert.equal(app.investmentTax(720), 0.175);
  assert.equal(app.investmentTax(721), 0.15);
});

test('simulador de investimentos: CDB, Tesouro Selic e poupança em 12 meses', () => {
  const app = loadApp({ inputs: { '#inv-amount': '10000', '#inv-months': '12', '#inv-cdi': '100' } });
  app.setRates({ cdi: { value: 14.9 }, selic: { value: 15 }, ipca: { value: 0.48 } });
  const p = app.investmentProjection();
  assert.equal(p.ir, 0.175, '365 dias → 17,5%');
  near(p.cdiResult.gross, 1490);
  near(p.cdiResult.net, 1229.25);
  near(p.tesouro.gross, 1500);
  near(p.tesouro.net, 1237.5);
  // Selic acima de 8,5% → poupança rende 0,5% ao mês
  near(p.poupanca, 10000 * (Math.pow(1.005, 12) - 1));
});

test('poupança com Selic até 8,5% rende 70% da Selic', () => {
  const app = loadApp({ inputs: { '#inv-amount': '1000', '#inv-months': '12', '#inv-cdi': '100' } });
  app.setRates({ cdi: { value: 7.9 }, selic: { value: 8 } });
  near(app.investmentProjection().poupanca, 1000 * (Math.pow(1 + 0.08 * 0.7 / 12, 12) - 1));
});

test('Páscoa e feriados móveis', () => {
  const app = loadApp();
  assert.equal(ymd(app.easterSunday(2024)), '2024-3-31');
  assert.equal(ymd(app.easterSunday(2025)), '2025-4-20');
  assert.equal(ymd(app.easterSunday(2026)), '2026-4-5');
  assert.equal(ymd(app.easterSunday(2027)), '2027-3-28');
  assert.ok(app.brazilHoliday(new Date(2026, 3, 3)), 'Sexta-feira Santa 2026');
  assert.ok(app.brazilHoliday(new Date(2026, 5, 4)), 'Corpus Christi 2026');
  assert.ok(app.brazilHoliday(new Date(2026, 11, 25)), 'Natal');
  assert.ok(app.brazilHoliday(new Date(2026, 10, 20)), 'Consciência Negra');
  assert.ok(!app.brazilHoliday(new Date(2026, 10, 6)), 'dia comum');
});

test('dias úteis e vencimentos', () => {
  const app = loadApp();
  // 1/11/2026 é domingo e 2/11 é Finados: 3, 4, 5, 6 e 9
  assert.equal(ymd(app.fifthBusinessDay(2026, 10)), '2026-11-9');
  assert.equal(ymd(app.fifthBusinessDay(2026, 11)), '2026-12-7');
  assert.equal(ymd(app.lastBusinessDay(2026, 9)), '2026-10-30', 'outubro/2026 termina num sábado');
  assert.equal(ymd(app.lastBusinessDay(2026, 11)), '2026-12-31');
  assert.equal(ymd(app.nextBusinessDay(new Date(2026, 10, 14))), '2026-11-16', 'sábado + domingo feriado → segunda');
  assert.equal(ymd(app.nextBusinessDay(new Date(2026, 10, 20))), '2026-11-23', 'feriado na sexta → segunda');
  assert.equal(ymd(app.rowDueDate('2026-11', { dia: 15 })), '2026-11-16');
  assert.equal(ymd(app.debtDueDate(2026, 10, 10)), '2026-11-10');
});

test('vencimento de assinaturas', () => {
  const app = loadApp();
  assert.equal(ymd(app.subscriptionDueDate(2026, 10, { regraVencimento: '5º dia útil' })), '2026-11-9');
  assert.equal(ymd(app.subscriptionDueDate(2026, 10, { dia: 8 })), '2026-11-9', 'dia 8 cai num domingo');
  // dia 31 em fevereiro vira o último dia do mês (sábado, 28) e então o próximo dia útil
  assert.equal(ymd(app.subscriptionDueDate(2026, 1, { dia: 31 })), '2026-3-2');
});

test('importação de extrato: valores em formatos brasileiro e americano', () => {
  const app = loadApp();
  assert.equal(app.parseStatementAmount('1.234,56'), 1234.56);
  assert.equal(app.parseStatementAmount('1,234.56'), 1234.56);
  assert.equal(app.parseStatementAmount('R$ -89,90'), -89.9);
  assert.equal(app.parseStatementAmount('150'), 150);
  assert.equal(app.parseStatementAmount(''), 0);
});

test('importação de extrato: leitura de linhas CSV com aspas', () => {
  const app = loadApp();
  assert.deepEqual(plain(app.parseCsvLine('05/11/2026;"Mercado; centro";"-12,30"', ';')), ['05/11/2026', 'Mercado; centro', '-12,30']);
  assert.deepEqual(plain(app.parseCsvLine('a,"diz ""oi""",c', ',')), ['a', 'diz "oi"', 'c']);
});

test('extrato mensal: totais por tipo de lançamento', () => {
  const app = loadApp();
  const t = app.statementTotals([
    { ledger: 'financeiro', direction: 'Entrada', status: 'Recebido', value: 5000 },
    { ledger: 'financeiro', direction: 'Saída', status: 'Pago', value: 1200 },
    { ledger: 'financeiro', direction: 'Saída', status: 'Pendente', value: 300 },
    { ledger: 'financeiro', direction: 'Entrada', status: 'Recebido', value: 50, includeInBalance: false },
    { ledger: 'alimentacao', direction: 'Benefício', status: 'Disponibilizado', value: 650 },
    { ledger: 'alimentacao', direction: 'Saída', status: 'Pago', value: 200 },
  ]);
  assert.equal(t.financialBalance, 3800);
  assert.equal(t.received, 5000);
  assert.equal(t.paid, 1200);
  assert.equal(t.pending, 300);
  assert.equal(t.benefitBalance, 450);
});
