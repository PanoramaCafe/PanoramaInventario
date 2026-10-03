/* =====================================================================
   js/15-sync-supabase.js
   ---------------------------------------------------------------------
   Sincronización segura con Supabase y protección de cambios locales
   pendientes cuando el dispositivo trabaja sin conexión.
   ===================================================================== */
(() => {
  const SUPABASE_URL='https://dtmhffgpwxzdncbuoohb.supabase.co';
  const SUPABASE_KEY='sb_publishable_S_wZkfLNvx0mnHBLGHcfgg_Q_SkycdW';
  const ROW_ID='main';
  const TABLE='panorama_inventario_state';

  let client=null, ready=false, applyingRemote=false, timer=null, channel=null, lastUpdatedAt='', pushing=false, saveSeq=0, retryTimer=null, loginShown=false;
  const LASTSYNC_KEY=LOCAL_KEY+'_lastsync', BACKUP_KEY=LOCAL_KEY+'_remote_backup', BASE_KEY=LOCAL_KEY+'_base';
  const LIST_KEYS=['categories','suppliers','products','orders','counts','recipes','loza'];
  const norm=x=>String(x??'').trim().toLowerCase();
  const unitFactorMap={g:['mass',1],gramos:['mass',1],gramo:['mass',1],kg:['mass',1000],kilo:['mass',1000],lb:['mass',453.59237],libra:['mass',453.59237],ml:['vol',1],mililitro:['vol',1],l:['vol',1000],litro:['vol',1000],oz:['vol',29.5735295625],'onza líquida':['vol',29.5735295625],onza:['mass',28.349523125],pieza:['count',1],piezas:['count',1],pza:['count',1],pzs:['count',1]};

  function factor(from,to){const a=unitFactorMap[norm(from)],b=unitFactorMap[norm(to)];return a&&b&&a[0]===b[0]?a[1]/b[1]:null;}
  function inferMode(p){
    const u=norm(p?.unit||p?.usageUnit||'');
    if(p?.stockMode==='warehouse'||p?.stockMode==='bodega')return'warehouse';
    if(p?.stockMode==='level'||p?.stockMode==='approx')return'level';
    if(p?.stockMode==='exact'||p?.stockMode==='measure')return'exact';
    if(p?.stockMode==='count')return'count';
    return ['pieza','piezas','pza','pzs'].includes(u)?'count':'exact';
  }
  function migrateProduct(p){
    const q={...p},mode=inferMode(q);q.stockMode=mode;
    if(!q.unit&&q.usageUnit)q.unit=q.usageUnit;if(!q.usageUnit)q.usageUnit=q.unit||'';if(!q.costUnit)q.costUnit=q.unit||q.usageUnit||'';
    if(!q.stockUnit)q.stockUnit=mode==='count'?'pieza':(mode==='exact'?(q.unit||'pieza'):'');
    if(mode==='level'){
      if(q.stockLevel!==''&&q.stockLevel!=null){const n=Number(q.stockLevel);q.stockLevel=Number.isFinite(n)&&[0,10,25,50,75,100].includes(n)?n:'';}
      else if(Number(q.stock)>=0&&Number(q.stock)<=1&&Number(q.stock)!==0)q.stockLevel=Math.round(Number(q.stock)*100);else q.stockLevel='';
      q.stock=0;
    }
    if(q.purchasePrice==null&&q.cost!=null){const pcs=Number(q.purchaseUnitsPerPresentation||q.purchasePiecesPerUnit||1)||1,content=Number(q.purchaseContentQty||0),contentUnit=q.purchaseContentUnit||q.unit||'';if(content>0&&q.unit){const f=factor(contentUnit,q.unit),usagePerPresentation=pcs*content*(f===null?1:f);q.purchasePrice=Number(q.cost)*usagePerPresentation;}else q.purchasePrice=Number(q.cost)*pcs;}
    q.purchaseUnitsPerPresentation=Number(q.purchaseUnitsPerPresentation||q.purchasePiecesPerUnit||1)||1;if(q.purchaseContentQty==null)q.purchaseContentQty=Number(q.purchaseUnitQty)||0;if(!Array.isArray(q.history))q.history=[];return q;
  }
  function migrateLoza(q){q=q||{};q.qty=Number(q.qty)||0;q.unitCost=Number(q.unitCost)||0;if(q.targetQty!==''&&q.targetQty!=null)q.targetQty=Number(q.targetQty);if(q.minStock!==''&&q.minStock!=null)q.minStock=Number(q.minStock);if(!Array.isArray(q.history))q.history=[];return q;}
  function normalize(s){return{categories:Array.isArray(s?.categories)?s.categories:[],suppliers:Array.isArray(s?.suppliers)?s.suppliers:[],products:Array.isArray(s?.products)?s.products.map(migrateProduct):[],orders:Array.isArray(s?.orders)?s.orders:[],counts:Array.isArray(s?.counts)?s.counts:[],recipes:Array.isArray(s?.recipes)?s.recipes:[],loza:Array.isArray(s?.loza)?s.loza.map(migrateLoza):[]};}
  function hasPending(){try{return localStorage.getItem(LOCAL_KEY+'_pending')==='1';}catch(e){return false;}}
  function sameTs(a,b){if(!a||!b)return false;const x=Date.parse(a),y=Date.parse(b);return Number.isFinite(x)&&Number.isFinite(y)?x===y:a===b;}
  function setLast(v){lastUpdatedAt=v||'';try{if(v)localStorage.setItem(LASTSYNC_KEY,v);}catch(e){}}
  function getStoredLast(){try{return localStorage.getItem(LASTSYNC_KEY)||'';}catch(e){return '';}}
  function status(t,ok=false){window.panoramaCloudStatus=t;const e=document.getElementById('cloud-sync-status');if(e){e.textContent=t;e.className='badge'+(ok?' ok':'');}}
  window.panoramaNormalizeState=normalize;

  /* ---------- Fusión de estados (evita que un dispositivo pise a otro) ---------- */
  function mergeHistory(a,b){const seen=new Set(),out=[];[...(a||[]),...(b||[])].forEach(h=>{const k=h&&h.id?h.id:JSON.stringify(h);if(!seen.has(k)){seen.add(k);out.push(h);}});return out.sort((x,y)=>String(x?.date||'').localeCompare(String(y?.date||'')));}
  const same=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
  function getBase(){try{const r=localStorage.getItem(BASE_KEY);return r?JSON.parse(r):null;}catch(e){return null;}}
  function setBase(str){try{localStorage.setItem(BASE_KEY,typeof str==='string'?str:JSON.stringify(str));}catch(e){}}
  // Fusión de tres vías por id: base = último estado confirmado con la nube en este dispositivo.
  function mergeList(localArr,remoteArr,baseArr){
    const hasBase=Array.isArray(baseArr);
    const idMap=arr=>{const m=new Map();(arr||[]).forEach(it=>{if(it&&it.id!=null)m.set(it.id,it);});return m;};
    const L=idMap(localArr),R=idMap(remoteArr),Bm=idMap(baseArr);
    const out=[],done=new Set();
    const take=(id)=>{
      const l=L.get(id),r=R.get(id),b=Bm.get(id);
      if(l&&r){
        if(!hasBase)return (Array.isArray(l.history)||Array.isArray(r.history))?{...l,history:mergeHistory(l.history,r.history)}:l;
        if(b&&same(l,b))return r;
        if(b&&same(r,b))return l;
        return (Array.isArray(l.history)||Array.isArray(r.history))?{...l,history:mergeHistory(l.history,r.history)}:l;
      }
      if(l&&!r){ if(hasBase&&b&&same(l,b))return null; return l; }   // borrado en otro dispositivo
      if(r&&!l){ if(hasBase&&b&&same(r,b))return null; return r; }   // borrado aquí
      return null;
    };
    (localArr||[]).forEach(it=>{if(it&&it.id!=null){if(done.has(it.id))return;done.add(it.id);const v=take(it.id);if(v)out.push(v);}else out.push(it);});
    (remoteArr||[]).forEach(it=>{if(it&&it.id!=null){if(done.has(it.id))return;done.add(it.id);const v=take(it.id);if(v)out.push(v);}});
    const seen=new Set(out.filter(x=>!(x&&x.id!=null)).map(x=>JSON.stringify(x)));
    (remoteArr||[]).forEach(x=>{if(!(x&&x.id!=null)){const k=JSON.stringify(x);if(!seen.has(k)){seen.add(k);out.push(x);}}});
    return out;
  }
  function mergeStates(local,remote,base){const out={};LIST_KEYS.forEach(k=>{out[k]=mergeList(local?.[k],remote?.[k],base?base[k]:null);});return out;}

  function showLogin(msg){
    if(document.getElementById('modal-backdrop')||typeof openModal!=='function')return;
    openModal(`<h3>Iniciar sesión</h3><p style="font-size:0.88rem;color:var(--chalk-dim);line-height:1.5;margin:0 0 12px;">${esc(msg||'Entra con la cuenta de Panorama para sincronizar tu inventario.')}</p><div class="field"><label>Correo</label><input id="auth-email" type="email" autocomplete="username"></div><div class="field"><label>Contraseña</label><input id="auth-pass" type="password" autocomplete="current-password"></div><div id="auth-err" style="color:var(--rose);font-size:0.8rem;min-height:1em;"></div><div class="modal-actions"><button class="btn ghost" id="auth-cancel">Ahora no</button><button class="btn" id="auth-go">Entrar</button></div>`);
    document.getElementById('auth-cancel').onclick=closeModal;
    document.getElementById('auth-go').onclick=async()=>{
      const email=document.getElementById('auth-email').value.trim(),password=document.getElementById('auth-pass').value;
      const {error}=await client.auth.signInWithPassword({email,password});
      if(error){document.getElementById('auth-err').textContent='Correo o contraseña incorrectos';return;}
      closeModal();loginShown=false;updateAuthButton();await syncNow();
    };
  }
  async function updateAuthButton(){
    const b=document.getElementById('btn-cloud-auth');if(!b||!client)return;
    const {data}=await client.auth.getSession();
    if(data?.session){b.textContent='Cerrar sesión';b.onclick=async()=>{await client.auth.signOut();status('Sesión cerrada',false);updateAuthButton();};}
    else{b.textContent='Iniciar sesión';b.onclick=()=>showLogin();}
  }
  function isAuthError(e){const m=String(e?.message||'').toLowerCase();return e?.code==='42501'||e?.status===401||e?.status===403||m.includes('row-level security')||m.includes('jwt')||m.includes('permission denied');}
  function handleError(e,offlineMsg){
    if(isAuthError(e)){status('Requiere iniciar sesión',false);if(!loginShown){loginShown=true;showLogin('La nube ahora pide iniciar sesión.');}}
    else status(offlineMsg,false);
    scheduleRetry();
  }
  function scheduleRetry(){clearTimeout(retryTimer);if(!hasPending())return;retryTimer=setTimeout(()=>{if(ready&&hasPending())pushRemote();},15000);}

  function addSyncCard(){const holder=document.getElementById('install-card');if(!holder||document.getElementById('cloud-sync-card'))return;const c=document.createElement('div');c.className='card';c.id='cloud-sync-card';c.innerHTML='<h2>Sincronización entre dispositivos</h2><div class="card-sub">Una sola información para Panorama Inventario</div><div class="pill-row"><span id="cloud-sync-status" class="badge">Conectando…</span><button class="btn ghost small" id="btn-cloud-sync">↻ Sincronizar ahora</button><button class="btn ghost small" id="btn-cloud-auth">Iniciar sesión</button></div>';holder.parentNode.insertBefore(c,holder);document.getElementById('btn-cloud-sync').onclick=syncNow;if(window.panoramaCloudStatus)status(window.panoramaCloudStatus,/Sincroniz|Actualizado/.test(window.panoramaCloudStatus));updateAuthButton();}
  if(typeof window.addEventListener==='function')window.addEventListener('panorama:rendered',addSyncCard);

  function applyRemote(row){
    applyingRemote=true;
    state=normalize(row.data);setLast(row.updated_at);setBase(state);
    return storageSetValue(JSON.stringify(state)).then(()=>{render();}).finally(()=>{applyingRemote=false;});
  }

  async function loadRemote(){
    try{const {data,error}=await client.from(TABLE).select('data,updated_at').eq('id',ROW_ID).maybeSingle();if(error)throw error;if(data?.data){
      // Nunca descargar encima de un cambio local que aún no se confirma en la nube.
      if(hasPending())return{found:true,error:false,skipped:true};
      if(sameTs(data.updated_at,lastUpdatedAt))return{found:true,error:false,unchanged:true};
      await applyRemote(data);return{found:true,error:false};
    }return{found:false,error:false};}catch(e){applyingRemote=false;handleError(e,'No se pudo leer la nube; no se modificará');return{found:false,error:true};}
  }

  // Hay un cambio en la nube que este dispositivo no conocía: se fusiona y se vuelve a intentar subir.
  async function resolveConflict(){
    const {data:remote,error}=await client.from(TABLE).select('data,updated_at').eq('id',ROW_ID).maybeSingle();
    if(error)throw error;
    if(!remote?.data){
      const now=new Date().toISOString();
      const {data,error:e2}=await client.from(TABLE).upsert({id:ROW_ID,data:state,updated_at:now},{onConflict:'id'}).select('updated_at').single();
      if(e2)throw e2;setLast(data?.updated_at||now);setBase(state);return true;
    }
    try{localStorage.setItem(BACKUP_KEY,JSON.stringify({savedAt:new Date().toISOString(),remote:remote.data}));}catch(e){}
    state=normalize(mergeStates(state,remote.data,getBase()));
    setLast(remote.updated_at);
    await storageSetValue(JSON.stringify(state));
    render();
    if(typeof showToast==='function')showToast('Se combinaron cambios hechos en otro dispositivo');
    return null; // el llamador reintenta la subida con la versión nueva
  }

  async function pushRemote(){
    if(!client||!ready||applyingRemote)return false;
    if(pushing){window.__panoramaPushAgain=true;return false;}
    pushing=true;const seq=saveSeq;
    try{
      let confirmed=false;
      for(let attempt=0;attempt<3&&!confirmed;attempt++){
        const now=new Date().toISOString();const snap=JSON.stringify(state);
        if(window.panoramaForceOverwrite){
          const {data,error}=await client.from(TABLE).upsert({id:ROW_ID,data:state,updated_at:now},{onConflict:'id'}).select('updated_at').single();
          if(error)throw error;setLast(data?.updated_at||now);setBase(snap);window.panoramaForceOverwrite=false;confirmed=true;
        }else if(!lastUpdatedAt){
          const r=await resolveConflict();if(r===true)confirmed=true;
        }else{
          const {data,error}=await client.from(TABLE).update({data:state,updated_at:now}).eq('id',ROW_ID).eq('updated_at',lastUpdatedAt).select('updated_at');
          if(error)throw error;
          if(data&&data.length){setLast(data[0].updated_at||now);setBase(snap);confirmed=true;}
          else await resolveConflict();
        }
      }
      if(!confirmed){status('Conflicto sin resolver; se reintentará',false);scheduleRetry();return false;}
      if(seq===saveSeq){try{localStorage.removeItem(LOCAL_KEY+'_pending');}catch(e){}status('Sincronizado',true);}
      else queue();
      return true;
    }catch(e){handleError(e,'Sin conexión — guardado local');return false;}
    finally{pushing=false;if(window.__panoramaPushAgain){window.__panoramaPushAgain=false;queue();}}
  }
  function queue(){clearTimeout(timer);timer=setTimeout(pushRemote,350);}
  function subscribe(){
    if(channel)return;
    channel=client.channel('panorama-inventario-sync').on('postgres_changes',{event:'*',schema:'public',table:TABLE,filter:'id=eq.main'},async payload=>{
      const r=payload.new;if(!r?.data||sameTs(r.updated_at,lastUpdatedAt))return;
      // Con un cambio local pendiente, la copia local manda; se fusionará al subir.
      if(hasPending()){status('Cambio local pendiente de sincronizar',false);return;}
      await applyRemote(r);status('Actualizado en tiempo real',true);
    }).subscribe(s=>{if(s==='SUBSCRIBED')status('Sincronización en tiempo real activa',true);});
  }
  async function syncNow(){
    if(!client)return;
    if(hasPending()){
      ready=true;
      if(!lastUpdatedAt)lastUpdatedAt=getStoredLast();
      const ok=await pushRemote();if(ok)subscribe();else status('Sin conexión — cambios guardados localmente',false);return;
    }
    const result=await loadRemote();if(result.error){ready=false;return;}ready=true;if(!result.found)await pushRemote();subscribe();status('Sincronización en tiempo real activa',true);
  }
  function bindSaveNotification(){
    window.addEventListener('panorama:state-saved',()=>{saveSeq++;queue();});
    // Reintentar al recuperar conexión y refrescar al volver a la app.
    window.addEventListener('online',()=>{if(!client)return;if(ready&&hasPending())pushRemote();else syncNow();});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible'||!client)return;if(ready&&hasPending())pushRemote();else syncNow();});
  }
  async function init(){
    addSyncCard();
    if(!window.supabase){const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';await new Promise(resolve=>{s.onload=resolve;s.onerror=resolve;document.head.appendChild(s);});}
    if(!window.supabase){status('Sin Supabase — guardado local',false);return;}
    client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);bindSaveNotification();
    client.auth.onAuthStateChange(ev=>{if(ev==='SIGNED_OUT'||ev==='SIGNED_IN'){if(channel){try{client.removeChannel(channel);}catch(e){}channel=null;}updateAuthButton();}});
    await syncNow();
    try{const before=JSON.stringify(state.products||[]);state=normalize(state);if(JSON.stringify(state.products||[])!==before){await storageSetValue(JSON.stringify(state));if(ready)await pushRemote();render();}}catch(e){}
  }
  setTimeout(init,0);
})();
