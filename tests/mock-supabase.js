// Supabase simulado — usado só nos testes locais (tests/visual e tests/sync).
// Nunca é carregado pelo app publicado. Substitui vendor/supabase-js-*.min.js
// via interceptação de rede no Playwright.
//
// A "nuvem" fica no localStorage da origem, então duas abas do mesmo navegador
// se comportam como dois aparelhos da mesma conta.
(()=>{'use strict';
const KEY='__mock_cloud';
const USER={id:'00000000-0000-4000-8000-000000000001',email:'ana@exemplo.com'};
const load=()=>JSON.parse(localStorage.getItem(KEY)||'{"user_data":{},"profiles":{}}');
const store=db=>localStorage.setItem(KEY,JSON.stringify(db));
const role=()=>localStorage.getItem('__mock_role')||'common';
const loggedIn=()=>localStorage.getItem('__mock_logged_out')!=='1';
const delay=()=>new Promise(r=>setTimeout(r,+(localStorage.getItem('__mock_delay')||10)));
window.__mockSupabaseCalls=[];

function rowsOf(db,table){
  if(table==='user_data')return Object.entries(db.user_data).map(([user_id,r])=>({user_id,...r}));
  if(table==='profiles')return [{user_id:USER.id,email:USER.email,display_name:'Ana',role:role(),module_access:{},created_at:'2026-01-01T00:00:00Z',last_seen_at:null}];
  return [];
}
class Query{
  constructor(table){this.table=table;this.filters=[];this.op='select';this.payload=null;this.mode='many';this.wantRows=false}
  select(){if(this.op!=='select')this.wantRows=true;return this}
  eq(col,val){this.filters.push([col,val]);return this}
  order(){return this}
  maybeSingle(){this.mode='maybe';return this}
  single(){this.mode='single';return this}
  update(row){this.op='update';this.payload=row;return this}
  insert(row){this.op='insert';this.payload=row;return this}
  upsert(row){this.op='upsert';this.payload=row;return this}
  then(ok,fail){return this.run().then(ok,fail)}
  async run(){
    await delay();
    if(localStorage.getItem('__mock_offline')==='1')throw new TypeError('Failed to fetch');
    window.__mockSupabaseCalls.push({table:this.table,op:this.op,filters:this.filters});
    const db=load();
    const match=r=>this.filters.every(([c,v])=>String(r[c])===String(v));
    let data=[];
    if(this.table==='user_data'&&this.op!=='select'){
      const row=this.payload;
      if(this.op==='insert'){
        if(db.user_data[row.user_id])return {data:null,error:{code:'23505',message:'duplicate key'}};
        db.user_data[row.user_id]={state:row.state,updated_at:row.updated_at};store(db);data=[{...row}];
      }else if(this.op==='upsert'){
        db.user_data[row.user_id]={state:row.state,updated_at:row.updated_at};store(db);data=[{...row}];
      }else{
        data=rowsOf(db,'user_data').filter(match);
        data.forEach(r=>{db.user_data[r.user_id]={...db.user_data[r.user_id],...row}});
        store(db);data=data.map(r=>({...r,...row}));
      }
      if(!this.wantRows&&this.mode==='many')return {data:null,error:null};
    }else{
      data=rowsOf(db,this.table).filter(match);
    }
    if(this.mode==='single')return data.length===1?{data:data[0],error:null}:{data:null,error:{code:'PGRST116',message:'no rows'}};
    if(this.mode==='maybe')return {data:data[0]||null,error:null};
    return {data,error:null};
  }
}
const session=()=>loggedIn()?{user:USER,access_token:'mock'}:null;
const client={
  from:t=>new Query(t),
  rpc:async()=>({data:null,error:null}),
  functions:{invoke:async()=>({data:{},error:null})},
  auth:{
    getSession:async()=>({data:{session:session()},error:null}),
    onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
    signInWithPassword:async()=>{localStorage.removeItem('__mock_logged_out');return {data:{session:session(),user:USER},error:null}},
    signUp:async()=>({data:{},error:null}),
    signOut:async()=>{localStorage.setItem('__mock_logged_out','1');return {error:null}},
    resetPasswordForEmail:async()=>({error:null}),
    updateUser:async()=>({error:null})
  }
};
window.supabase={createClient:()=>client};
window.__mockCloud={load,store,USER};
})();
