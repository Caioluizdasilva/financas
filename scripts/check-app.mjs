// Verificações estáticas do Finanças (rodam no GitHub a cada envio).
//
// 1. Sintaxe de todos os arquivos JavaScript.
// 2. Todo arquivo listado no cache do service worker (sw.js) existe — se faltar
//    um só, a instalação offline falha inteira.
// 3. Todo arquivo local que o index.html e o style.css carregam está no cache,
//    para o app abrir sem internet.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const errors = [];
const read = f => readFileSync(f, 'utf8');

for (const file of ['app.js', 'auth.js', 'seed.js', 'sw.js']) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (e) {
    errors.push(`${file}: erro de sintaxe\n${e.stderr}`);
  }
}

const sw = read('sw.js');
const list = sw.match(/const FILES=\[([\s\S]*?)\];/);
if (!list) errors.push('sw.js: lista FILES não encontrada');
const cached = new Set([...(list?.[1] ?? '').matchAll(/'([^']+)'/g)].map(m => m[1]));
for (const file of cached) {
  if (file !== './' && !existsSync(file)) errors.push(`sw.js: "${file}" está no cache, mas o arquivo não existe`);
}

const local = url => url && !/^(https?:|data:|#|\/\/)/.test(url);
const html = read('index.html');
const fromHtml = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]).filter(local).filter(u => u !== './');
const fromCss = [...read('style.css').matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map(m => m[1].replace(/^\.\//, '')).filter(local);
for (const file of [...fromHtml, ...fromCss]) {
  if (!existsSync(file)) errors.push(`"${file}" é carregado pelo app, mas não existe`);
  else if (!cached.has(file)) errors.push(`"${file}" é carregado pelo app, mas não está em FILES no sw.js (não abriria offline)`);
}
for (const m of html.matchAll(/<script[^>]+src="(https?:[^"]+)"/g)) {
  errors.push(`index.html carrega um script externo (${m[1]}); guarde-o em vendor/ para o app funcionar offline`);
}

if (errors.length) {
  console.error('Problemas encontrados:\n- ' + errors.join('\n- '));
  process.exit(1);
}
console.log(`OK: ${cached.size} arquivos no cache offline, ${fromHtml.length + fromCss.length} referências locais conferidas.`);
