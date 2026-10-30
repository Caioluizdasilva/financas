(()=>{'use strict';
const SUPABASE_URL='https://dndywuldnugkehqntcar.supabase.co';
const SUPABASE_KEY='sb_publishable_6GDIhr-ypwT8gF0X_OmI9w_G7MiEfYG';
const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
let session=null,appReady=false,activated=false,timer=null,saving=false;
const $=s=>document.querySelector(s);
function mount(){if($('#auth-screen'))return;const root=document.createElement('section');root.id='auth-screen';root.innerHTML=`
<div class="auth-site">
<header class="auth-nav">
  <a class="auth-brand" href="#" data-auth-home aria-label="Finanças, início"><span class="brand-symbol">f.</span><span><strong>finanças.</strong><small>SEU DINHEIRO, SEUS PLANOS</small></span></a>
  <nav class="auth-nav-actions" aria-label="Acesso à conta"><button type="button" class="auth-nav-login" data-auth-mode="login">Entrar</button><button type="button" class="auth-nav-cta" data-auth-mode="signup">Criar minha conta <span>↗</span></button></nav>
</header>
<main class="auth-landing" id="auth-landing">
  <section class="auth-hero">
    <div class="auth-hero-copy">
      <p class="auth-kicker"><i></i> ORGANIZE. ENTENDA. DECIDA.</p>
      <h1>Seu dinheiro merece <em>um plano.</em></h1>
      <p class="auth-hero-text">Uma vida financeira mais clara começa quando você sabe para onde seu dinheiro vai — e consegue escolher para onde ele pode ir.</p>
      <div class="auth-hero-actions"><button type="button" class="auth-primary-cta" data-auth-mode="signup">Começar agora <span>↗</span></button><button type="button" class="auth-text-cta" data-auth-mode="login">Já tenho uma conta <span>→</span></button></div>
      <div class="auth-proof"><span class="auth-proof-mark">✳</span><span>Mais clareza nas escolhas.<br><b>Mais intenção em cada passo.</b></span></div>
    </div>
    <div class="auth-hero-art" aria-label="Prévia ilustrativa do painel financeiro">
      <div class="auth-art-orbit orbit-one"></div><div class="auth-art-orbit orbit-two"></div>
      <div class="auth-art-note">SEU MÊS, SOB CONTROLE <span>✳</span></div>
      <div class="auth-art-card">
        <div class="auth-art-card-top"><span>VISÃO GERAL</span><i>•••</i></div>
        <p>Saldo projetado</p><strong>R$ 2.480<span>,00</span></strong>
        <div class="auth-art-chart"><i style="height:34%"></i><i style="height:49%"></i><i style="height:42%"></i><i style="height:66%"></i><i style="height:57%"></i><i style="height:82%"></i><i style="height:72%"></i><i style="height:94%"></i></div>
        <div class="auth-art-card-foot"><span><i></i> Entradas</span><span><i></i> Despesas</span></div>
      </div>
      <div class="auth-art-float"><span>✦</span><div><small>DECISÕES MELHORES</small><b>Um passo de cada vez.</b></div></div>
      <div class="auth-art-stamp">f.</div>
    </div>
  </section>
  <section class="auth-features">
    <div class="auth-section-heading"><p class="auth-kicker">SEU DINHEIRO, COM DIREÇÃO</p><h2>Não é só controlar.<br><em>É fazer escolhas melhores.</em></h2></div>
    <div class="auth-feature-grid">
      <article><span class="auth-feature-icon">↗</span><small>01 / ORGANIZAÇÃO</small><h3>Entenda seu mês</h3><p>Reúna entradas, despesas, contas fixas e benefícios em uma visão simples e organizada.</p></article>
      <article><span class="auth-feature-icon">◎</span><small>02 / PLANEJAMENTO</small><h3>Planeje seus próximos passos</h3><p>Crie metas, acompanhe sua reserva e enxergue o caminho até seus objetivos.</p></article>
      <article><span class="auth-feature-icon">✳</span><small>03 / INTELIGÊNCIA</small><h3>Decida com consciência</h3><p>Analise compras, compare cenários e construa estratégias para lidar com dívidas.</p></article>
    </div>
  </section>
  <section class="auth-bottom-cta"><div><p class="auth-kicker">O PRÓXIMO PASSO É SEU</p><h2>Mais clareza hoje.<br><em>Mais tranquilidade amanhã.</em></h2></div><button type="button" class="auth-primary-cta" data-auth-mode="signup">Criar minha conta <span>↗</span></button></section>
  <footer class="auth-site-footer"><span>finanças. <small>SEU DINHEIRO, SEUS PLANOS</small></span><span>Clareza hoje. Tranquilidade amanhã.</span></footer>
</main>
<section class="auth-access" id="auth-access" hidden>
  <button type="button" class="auth-back-home" data-auth-home>← Voltar ao início</button>
  <div class="auth-card">
    <div class="auth-card-mark">f.</div>
    <p class="auth-kicker" id="auth-kicker">SEU ESPAÇO FINANCEIRO</p>
    <h1 id="auth-title">Bem-vindo de volta.</h1>
    <p class="auth-subtitle" id="auth-subtitle">Entre para acessar seu espaço financeiro.</p>
    <form id="auth-form">
      <label id="auth-name-wrap" hidden>Como podemos chamar você?<input id="auth-name" autocomplete="name" placeholder="Seu nome"></label>
      <label>E-mail<input id="auth-email" type="email" autocomplete="email" placeholder="voce@email.com" required></label>
      <label id="auth-password-wrap">Senha<input id="auth-password" type="password" autocomplete="current-password" minlength="8" placeholder="Sua senha" required></label>
      <label id="auth-confirm-wrap" hidden>Confirme sua senha<input id="auth-confirm" type="password" autocomplete="new-password" minlength="8" placeholder="Digite a senha novamente"></label>
      <div class="auth-form-meta"><span>ACESSO SEGURO À SUA CONTA</span><button type="button" id="auth-forgot">Esqueci minha senha</button></div>
      <p id="auth-error" role="alert" aria-live="polite"></p>
      <button class="auth-submit" type="submit" id="auth-submit">Entrar</button>
    </form>
    <div class="auth-links"><span id="auth-switch-text">Ainda não tem uma conta?</span><button type="button" id="auth-switch">Cadastre-se aqui</button></div>
  </div>
  <p class="auth-access-foot">FINANÇAS PESSOAIS · SEUS DADOS, PROTEGIDOS NA NUVEM</p>
</section>
</div>`;document.body.prepend(root);const shell=document.querySelector('.app-shell');if(shell)shell.style.visibility='hidden';wire();}
function message(t){const el=$('#auth-error');if(el)el.textContent=t||''}
function mode(m){const root=$('#auth-screen');$('#auth-landing').hidden=true;$('#auth-access').hidden=false;$('#auth-form').dataset.mode=m;message('');$('#auth-name-wrap').hidden=m!=='signup';$('#auth-confirm-wrap').hidden=!['signup','new-password'].includes(m);$('#auth-password-wrap').hidden=m==='reset';$('#auth-password').required=m!=='reset';$('#auth-confirm').required=['signup','new-password'].includes(m);$('#auth-kicker').textContent=m==='signup'?'COMECE SUA ORGANIZAÇÃO':m==='reset'?'RECUPERE SEU ACESSO':m==='new-password'?'SEGURANÇA DA SUA CONTA':'SEU ESPAÇO FINANCEIRO';$('#auth-title').textContent=m==='signup'?'Crie seu espaço.':m==='reset'?'Esqueceu sua senha?':m==='new-password'?'Defina uma nova senha.':'Que bom ter você de volta.';$('#auth-subtitle').textContent=m==='signup'?'Sua vida financeira mais clara começa por aqui.':m==='reset'?'Informe seu e-mail e enviaremos um link para redefinir sua senha.':m==='new-password'?'Escolha uma nova senha para continuar.':'Entre na sua conta para continuar de onde parou.';$('#auth-submit').textContent=m==='signup'?'Criar minha conta':m==='reset'?'Enviar link de recuperação':m==='new-password'?'Salvar nova senha':'Entrar na minha conta';$('#auth-forgot').hidden=m!=='login';$('#auth-switch-text').textContent=m==='signup'?'Já tem uma conta?':'Ainda não tem uma conta?';$('#auth-switch').hidden=m==='new-password'||m==='reset';$('#auth-switch').textContent=m==='signup'?'Fazer login':'Cadastre-se aqui';root.classList.toggle('auth-is-access',true);}
async function pushState(uid,state){const {error}=await client.from('user_data').upsert({user_id:uid,state,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error)throw error}
async function activate(user){if(activated||!appReady)return;message('Carregando seus dados da nuvem…');try{const {data,error}=await client.from('user_data').select('state').eq('user_id',user.id).maybeSingle();if(error)throw error;let cloud=data?.state;if(!cloud||!Object.keys(cloud).length){cloud=window.FinancasBridge.emptyState();await pushState(user.id,cloud)}if(!window.FinancasBridge.isValidState(cloud))throw Error('Os dados salvos na nuvem estão em formato inválido. Nenhum dado local foi utilizado.');window.FinancasBridge.setState(cloud);session=client.auth.getSession?session:null;activated=true;finish(user.id)}catch(e){message('Não foi possível acessar seus dados na nuvem. O aplicativo permanece bloqueado para proteger suas informações. '+(e.message||''))}}
function finish(uid){localStorage.setItem('financas.local-owner',uid);$('#auth-screen').remove();document.querySelector('.app-shell').style.visibility='visible';window.FinancasBridge.start()}
window.FinancasCloud={getEmail(){return session?.user?.email||''},async updateEmail(email){const {error}=await client.auth.updateUser({email});if(error)throw error},async updatePassword(password){const {error}=await client.auth.updateUser({password});if(error)throw error},async verifyPassword(password){const email=session?.user?.email;if(!email)throw Error('Sessão não encontrada. Entre novamente.');const {data,error}=await client.auth.signInWithPassword({email,password});if(error)throw Error('Senha incorreta. Nenhum dado foi apagado.');session=data.session;return true},async signOut(){const {error}=await client.auth.signOut();if(error)throw error;location.reload()},appReady(){appReady=true;if(session?.user)activate(session.user)},schedule(state){if(!session?.user||!activated)return;clearTimeout(timer);timer=setTimeout(async()=>{if(saving)return;saving=true;const saved=$('#saved');try{await pushState(session.user.id,state);if(saved){saved.textContent='Salvo na nuvem';saved.classList.add('on')}}catch(e){if(saved){saved.textContent='Falha ao salvar na nuvem';saved.classList.add('on')}console.error('Falha na sincronização com a nuvem:',e)}finally{saving=false}},500)}};
mount();client.auth.getSession().then(({data,error})=>{if(error){message(error.message);return}session=data.session;if(session?.user&&appReady)activate(session.user);else if(!session?.user)$('#auth-screen').classList.add('ready')});client.auth.onAuthStateChange((event,s)=>{if(event==='SIGNED_OUT'){session=null;activated=false}if(event==='PASSWORD_RECOVERY'){session=s;$('#auth-screen').classList.add('ready');mode('new-password')}});
})();