const KEY='financas.v2',$=s=>document.querySelector(s);
const BRL=n=>(+n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const PAL=['#ffe608','#ff9f1c','#ff5a5f','#4cc9f0','#4ade80','#b388ff','#ff7ab6','#2dd4bf','#ebff00','#9ca3af','#f97316','#60a5fa','#a3e635'];
const MN=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
let S;try{const j=JSON.parse(localStorage.getItem(KEY));if(j&&j.months)S=j}catch(e){}
S=S||JSON.parse(JSON.stringify(SEED));
const short=k=>{const[y,m]=k.split('-');return MN[m-1]+'/'+y.slice(2)};
const full=k=>{const[y,m]=k.split('-');return new Date(y,m-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'})};
const nowKey=(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')})();
let cur=S.keys.includes(nowKey)?nowKey:'painel',timer;
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));const e=$('#saved');e.classList.add('on');clearTimeout(timer);timer=setTimeout(()=>e.classList.remove('on'),1200)}catch(e){}}
function M(k){
  if(!S.months[k]){const p=S.months[S.keys[S.keys.indexOf(k)-1]];S.months[k]={salary:p?p.salary:0,bonus:0,gastos:[],fixos:[],parcelas:[],reserva:0,rendaFixa:0,esperado:{}}}
  return S.months[k]}
const catColor=c=>PAL[Math.max(0,S.cats.indexOf(c))%PAL.length];
function calc(k){
  const m=M(k),items=[...m.gastos,...m.fixos,...m.parcelas],byCat={},byTipo={};
  items.forEach(x=>{byCat[x.cat]=(byCat[x.cat]||0)+(+x.valor||0);byTipo[x.tipo]=(byTipo[x.tipo]||0)+(+x.valor||0)});
  const gasto=items.reduce((a,x)=>a+(+x.valor||0),0),entradas=(+m.salary||0)+(+m.bonus||0),inv=(+m.reserva||0)+(+m.rendaFixa||0);
  return{m,byCat,byTipo,gasto,entradas,inv,saldo:entradas-gasto-inv}}
const COLS={
 gastos:[['nome','Nome','t'],['dia','Dia','d'],['tipo','Tipo','tipo'],['cat','Categoria','cat'],['valor','Valor','n']],
 fixos:[['nome','Nome','t'],['pago','Pago?','b'],['dia','Dia','d'],['tipo','Tipo','tipo'],['cat','Categoria','cat'],['valor','Valor','n']],
 parcelas:[['nome','Nome','t'],['parc','Parcela','p'],['dia','Dia','d'],['tipo','Tipo','tipo'],['cat','Categoria','cat'],['valor','Valor','n']]};
function cell(k,key,i,col,row){
  const[f,,t]=col,oc=`onchange="upd('${k}','${key}',${i},'${f}',this.${t==='b'?'checked':'value'})"`;
  if(t==='b')return`<input type="checkbox" ${row[f]?'checked':''} ${oc}>`;
  if(t==='n')return`<input type="number" step="0.01" inputmode="decimal" value="${row[f]}" ${oc}>`;
  if(t==='d')return`<input type="number" class="d" min="1" max="31" value="${row[f]}" ${oc}>`;
  if(t==='tipo'||t==='cat'){const L=t==='tipo'?S.tipos:S.cats,bg=t==='cat'?catColor(row[f]):'var(--y)';
    return`<select class="chip" style="background:${bg}" ${oc}>${(L.includes(row[f])?L:[...L,row[f]]).map(o=>`<option ${o===row[f]?'selected':''}>${esc(o)}</option>`).join('')}</select>`}
  return`<input value="${esc(row[f])}" ${oc}>`}
function section(k,key,title,extra=''){
  const rows=M(k)[key],cols=COLS[key],tot=rows.reduce((a,r)=>a+(+r.valor||0),0);
  return`<section class="box"><h3><span>${title}</span>${extra}</h3><div class="tw wide"><table><tr>${cols.map(c=>`<th class="${c[2]==='n'?'r':''}">${c[1]}</th>`).join('')}<th></th></tr>
  ${rows.map((r,i)=>`<tr>${cols.map(c=>`<td>${cell(k,key,i,c,r)}</td>`).join('')}<td><button class="x" onclick="delRow('${k}','${key}',${i})" title="Remover">✕</button></td></tr>`).join('')}
  <tr class="tot"><td colspan="${cols.length-1}">Total</td><td class="r">${BRL(tot)}</td><td></td></tr></table></div>
  <button class="btn add" onclick="addRow('${k}','${key}')">+ Adicionar</button></section>`}
function pie(by,total){
  const it=Object.entries(by).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
  if(!total)return'';
  let off=0;const R=50,C=2*Math.PI*R;
  const arcs=it.map(([c,v])=>{const l=v/total*C,s=`<circle r="${R}" cx="100" cy="100" fill="none" stroke="${catColor(c)}" stroke-width="100" stroke-dasharray="${l} ${C-l}" stroke-dashoffset="${-off}" transform="rotate(-90 100 100)"/>`;off+=l;return s}).join('');
  return`<div class="pie"><svg viewBox="0 0 200 200"><circle r="100" cx="100" cy="100" fill="#000"/>${arcs}</svg><div class="leg">${it.map(([c,v])=>`<div><span class="dot" style="background:${catColor(c)}"></span>${esc(c)}<span style="margin-left:auto">${(v/total*100).toFixed(1)}%</span></div>`).join('')}</div></div>`}
function viewMes(k){
  const c=calc(k),m=c.m,inp=(f,v)=>`<input type="number" step="0.01" inputmode="decimal" value="${v}" onchange="setM('${k}','${f}',this.value)">`;
  const cats=[...new Set([...S.cats.filter(x=>c.byCat[x]||m.esperado[x]),...Object.keys(c.byCat)])];
  return`<div class="mh"><h2>${full(k)}</h2><div class="kpis"><div>Saldo<b class="${c.saldo<0?'neg':'pos'}">${BRL(c.saldo)}</b></div><div>Total de gastos<b>${BRL(c.gasto)}</b></div></div></div>
  <div class="g3">
   <section class="box"><h3>Entradas</h3><table><tr><td>Salário</td><td>${inp('salary',m.salary)}</td></tr><tr><td>Bônus / extras</td><td>${inp('bonus',m.bonus)}</td></tr><tr class="tot"><td>Total</td><td class="r">${BRL(c.entradas)}</td></tr></table></section>
   <section class="box"><h3>Saídas</h3><table>${Object.entries(c.byTipo).sort((a,b)=>b[1]-a[1]).map(([t,v])=>`<tr><td>${esc(t)}</td><td class="r">${BRL(v)}</td></tr>`).join('')||'<tr><td class="note">Nada lançado</td></tr>'}<tr class="tot"><td>Total</td><td class="r">${BRL(c.gasto)}</td></tr></table></section>
   <section class="box"><h3>Investimentos</h3><table><tr><td>Reserva</td><td>${inp('reserva',m.reserva)}</td></tr><tr><td>Renda fixa</td><td>${inp('rendaFixa',m.rendaFixa)}</td></tr><tr class="tot"><td>Total</td><td class="r">${BRL(c.inv)}</td></tr></table></section>
  </div>
  ${section(k,'gastos','Gastos do mês')}
  <div class="g2">${section(k,'fixos','Fixos / contas','<button class="btn g" onclick="copyPrev(\''+k+'\')">↧ copiar mês anterior</button>')}${section(k,'parcelas','Cartão e parcelas')}</div>
  <div class="g2">
   <section class="box"><h3><span>Gastos por categoria</span><button class="btn g" onclick="newCat()">+ categoria</button></h3><div class="tw wide"><table><tr><th>Categoria</th><th class="r">Esperado</th><th class="r">Gasto</th><th class="r">%</th></tr>
    ${cats.map(x=>`<tr><td><span class="chipl" style="background:${catColor(x)}">${esc(x)}</span></td><td><input type="number" step="0.01" value="${m.esperado[x]||''}" placeholder="0" onchange="setEsp('${k}','${esc(x)}',this.value)"></td><td class="r ${m.esperado[x]&&(c.byCat[x]||0)>m.esperado[x]?'neg':''}">${BRL(c.byCat[x])}</td><td class="r">${c.gasto?((c.byCat[x]||0)/c.gasto*100).toFixed(1):'0.0'}%</td></tr>`).join('')}
    <tr class="tot"><td>Total</td><td></td><td class="r">${BRL(c.gasto)}</td><td class="r">100%</td></tr></table></div>${pie(c.byCat,c.gasto)}</section>
   <section class="box"><h3>Gastos por tipo de pagamento</h3><table><tr><th>Tipo</th><th class="r">Gasto</th><th class="r">%</th></tr>${Object.entries(c.byTipo).sort((a,b)=>b[1]-a[1]).map(([t,v])=>`<tr><td>${esc(t)}</td><td class="r">${BRL(v)}</td><td class="r">${(v/c.gasto*100).toFixed(1)}%</td></tr>`).join('')}</table></section>
  </div>`}
function viewPainel(){
  const rows=S.keys.map(k=>({k,...calc(k)})),sum=f=>rows.reduce((a,r)=>a+f(r),0),mx=Math.max(1,...rows.map(r=>Math.max(r.entradas,r.gasto)));
  let acc=0;
  return`<div class="mh"><h2>Painel geral</h2><div class="kpis"><div>Entradas no ano<b>${BRL(sum(r=>r.entradas))}</b></div><div>Gastos<b>${BRL(sum(r=>r.gasto))}</b></div><div>Investido<b>${BRL(sum(r=>r.inv))}</b></div><div>Saldo<b class="${sum(r=>r.saldo)<0?'neg':'pos'}">${BRL(sum(r=>r.saldo))}</b></div></div></div>
  <div class="g2">
   <section class="box"><h3>Mês a mês</h3><div class="tw wide"><table><tr><th>Mês</th><th class="r">Entradas</th><th class="r">Gastos</th><th class="r">Investido</th><th class="r">Saldo</th></tr>
    ${rows.map(r=>`<tr style="cursor:pointer" onclick="go('${r.k}')"><td style="text-transform:capitalize;padding:6px 8px">${short(r.k)}</td><td class="r">${BRL(r.entradas)}</td><td class="r">${BRL(r.gasto)}</td><td class="r">${BRL(r.inv)}</td><td class="r ${r.saldo<0?'neg':'pos'}">${BRL(r.saldo)}</td></tr>`).join('')}</table></div></section>
   <section class="box"><h3>Entradas × gastos</h3><div class="bars">${rows.map(r=>`<div onclick="go('${r.k}')"><div class="p"><i class="s" style="height:${r.entradas/mx*100}%"></i><i style="height:${r.gasto/mx*100}%"></i></div>${short(r.k).slice(0,3)}</div>`).join('')}</div><p class="note">Cinza = entradas · Amarelo = gastos</p></section>
  </div>
  <div class="g2">
   <section class="box"><h3>Investimentos e reservas</h3><div class="tw wide"><table><tr><th>Mês</th><th class="r">Reserva</th><th class="r">Renda fixa</th><th class="r">Total</th><th class="r">Acumulado</th></tr>
    ${rows.map(r=>{acc+=r.inv;return`<tr><td style="text-transform:capitalize;padding:6px 8px">${short(r.k)}</td><td class="r">${BRL(r.m.reserva)}</td><td class="r">${BRL(r.m.rendaFixa)}</td><td class="r">${BRL(r.inv)}</td><td class="r">${BRL(acc)}</td></tr>`}).join('')}</table></div></section>
   <section class="box"><h3>Seus dados</h3><p class="note">Tudo é salvo automaticamente neste aparelho, a cada alteração. Para levar para outro aparelho, exporte o backup e importe lá.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn" onclick="exportar()">Exportar backup</button><button class="btn g" onclick="$('#file').click()">Importar</button><button class="btn g" onclick="if(confirm('Apagar tudo e voltar aos dados da planilha?')){S=JSON.parse(JSON.stringify(SEED));save();render()}">Restaurar planilha</button></div></section>
  </div>`}
function viewDiv(){
  const tot=S.debts.reduce((a,d)=>a+(+d.valor||0),0);
  return`<div class="mh"><h2>Dívidas</h2><div class="kpis"><div>Total devendo<b class="neg">${BRL(tot)}</b></div></div></div>
  <section class="box"><div class="tw"><table><tr><th>Dívida</th><th class="r">Quanto falta</th><th></th></tr>
  ${S.debts.map((d,i)=>`<tr><td><input value="${esc(d.nome)}" onchange="S.debts[${i}].nome=this.value;save()"></td><td><input type="number" step="0.01" value="${d.valor}" onchange="S.debts[${i}].valor=+this.value||0;save();render()"></td><td><button class="x" onclick="S.debts.splice(${i},1);save();render()">✕</button></td></tr>`).join('')}
  <tr class="tot"><td>Total</td><td class="r">${BRL(tot)}</td><td></td></tr></table></div><button class="btn add" onclick="S.debts.push({nome:'',valor:0});save();render()">+ Adicionar</button></section>`}
function render(){
  $('#tabs').innerHTML=[['painel','Painel'],...S.keys.map(k=>[k,short(k)]),['dividas','Dívidas']].map(([k,l])=>`<button class="${k===cur?'on':''}" onclick="go('${k}')">${l}</button>`).join('');
  $('#app').innerHTML=cur==='painel'?viewPainel():cur==='dividas'?viewDiv():viewMes(cur);
  const on=$('#tabs .on');if(on)on.scrollIntoView({inline:'center',block:'nearest'})}
function go(k){cur=k;render();scrollTo(0,0)}
function upd(k,key,i,f,v){const r=M(k)[key][i],t=COLS[key].find(c=>c[0]===f)[2];r[f]=t==='n'||t==='d'?(+v||0):v;save();render()}
function setM(k,f,v){M(k)[f]=+v||0;save();render()}
function setEsp(k,c,v){M(k).esperado[c]=+v||0;save();render()}
function addRow(k,key){const r={nome:'',dia:1,tipo:S.tipos[0],cat:S.cats[0],valor:0};if(key==='fixos')r.pago=false;if(key==='parcelas')r.parc='1/1';M(k)[key].push(r);save();render()}
function delRow(k,key,i){M(k)[key].splice(i,1);save();render()}
function newCat(){const n=(prompt('Nome da nova categoria:')||'').trim();if(n&&!S.cats.includes(n)){S.cats.push(n);save();render()}}
function copyPrev(k){
  const p=S.months[S.keys[S.keys.indexOf(k)-1]],m=M(k);if(!p)return alert('Não há mês anterior.');
  p.fixos.forEach(r=>m.fixos.push({...r,pago:false}));
  p.parcelas.forEach(r=>{const[a,b]=String(r.parc).split('/').map(Number);if(a&&b&&a<b)m.parcelas.push({...r,parc:(a+1)+'/'+b})});
  save();render()}
function exportar(){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(S)],{type:'application/json'}));a.download='financas-backup.json';a.click()}
$('#file').onchange=async e=>{try{const j=JSON.parse(await e.target.files[0].text());if(!j.months||!j.keys)throw 0;S=j;save();render()}catch{alert('Arquivo inválido.')}};
render();
if(navigator.storage&&navigator.storage.persist)navigator.storage.persist();
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
