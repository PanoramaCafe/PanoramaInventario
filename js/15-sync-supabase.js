/* =====================================================================
   js/15-sync-supabase.js
   ---------------------------------------------------------------------
   Sincronización en la nube contra Supabase (pull inicial, push con
   debounce, suscripción en tiempo real vía postgres_changes, y
   migración/normalización de productos antiguos).

   Se carga AL FINAL de todos los demás js/*.js porque depende de
   `state`, `LOCAL_KEY`, `storageSetValue` y `render`, definidos ahí.
   ===================================================================== */

/* Panorama Inventario — sincronización segura.
   No reemplaza openProductForm ni render: la interfaz principal vive en index.html. */
(() => {
  const SUPABASE_URL='https://dtmhffgpwxzdncbuoohb.supabase.co';
  const SUPABASE_KEY='sb_publishable_S_wZkfLNvx0mnHBLGHcfgg_Q_SkycdW';
  const ROW_ID='main';
  const TABLE='panorama_inventario_state';

  let client=null, ready=false, applyingRemote=false, timer=null, channel=null, lastUpdatedAt='';

  const norm=x=>String(x??'').trim().toLowerCase();
  const unitFactorMap={
    g:['mass',1], gramos:['mass',1], gramo:['mass',1],
    kg:['mass',1000], kilo:['mass',1000],
    lb:['mass',453.59237], libra:['mass',453.59237],
    ml:['vol',1], mililitro:['vol',1],
    l:['vol',1000], litro:['vol',1000],
    oz:['vol',29.5735295625], 'onza líquida':['vol',29.5735295625],
    onza:['mass',28.349523125],
    pieza:['count',1], piezas:['count',1], pza:['count',1], pzs:['count',1]
  };

  function factor(from,to){
    const a=unitFactorMap[norm(from)], b=unitFactorMap[norm(to)];
    return a&&b&&a[0]===b[0] ? a[1]/b[1] : null;
  }

  function inferMode(p){
    const u=norm(p?.unit||p?.usageUnit||'');
    const name=norm(`${p?.name||''} ${p?.purchaseUnit||''}`);
    // Valores actuales que usa el formulario de productos (index.html, select
    // #pf-stock-mode): 'warehouse', 'level', 'exact', 'count'. Se aceptan
    // también los nombres legados ('bodega','approx','measure') por si hay
    // datos antiguos guardados con esas etiquetas — pero SIEMPRE hay que
    // reconocer los valores actuales primero, o cualquier producto en modo
    // 'warehouse'/'level' se reescribe a 'exact' en cada carga de página.
    if(p?.stockMode==='warehouse' || p?.stockMode==='bodega') return 'warehouse';
    if(p?.stockMode==='level' || p?.stockMode==='approx') return 'level';
    if(p?.stockMode==='exact' || p?.stockMode==='measure') return 'exact';
    if(p?.stockMode==='count') return 'count';
    // Migración conservadora: nunca asignar 'nivel' por el nombre del producto.
    // Los productos antiguos siguen con su forma más compatible de conteo.
    if(['pieza','piezas','pza','pzs'].includes(u)) return 'count';
    return 'exact';
  }

  function migrateProduct(p){
    const q={...p};
    const mode=inferMode(q);
    q.stockMode=mode;

    if(!q.unit && q.usageUnit) q.unit=q.usageUnit;
    if(!q.usageUnit) q.usageUnit=q.unit||'';
    if(!q.costUnit) q.costUnit=q.unit||q.usageUnit||'';

    if(!q.stockUnit){
      q.stockUnit=mode==='count' ? 'pieza' : (mode==='exact' ? (q.unit||'pieza') : '');
    }

    if(mode==='level'){
      if(q.stockLevel!=='' && q.stockLevel!=null){
        const n=Number(q.stockLevel);
        if(Number.isFinite(n) && [0,10,25,50,75,100].includes(n)) q.stockLevel=n;
        else q.stockLevel='';
      }else if(Number(q.stock)>=0 && Number(q.stock)<=1 && Number(q.stock)!==0){
        q.stockLevel=Math.round(Number(q.stock)*100);
      }else{
        q.stockLevel='';
      }
      // Never interpret a percentage as a numeric piece/g/ml stock.
      q.stock=0;
    }

    if(q.purchasePrice==null && q.cost!=null){
      const pcs=Number(q.purchaseUnitsPerPresentation||q.purchasePiecesPerUnit||1)||1;
      const content=Number(q.purchaseContentQty||0);
      const contentUnit=q.purchaseContentUnit||q.unit||'';
      if(content>0 && q.unit){
        const f=factor(contentUnit,q.unit);
        const usagePerPresentation=pcs*content*(f===null?1:f);
        q.purchasePrice=Number(q.cost)*usagePerPresentation;
      }else{
        q.purchasePrice=Number(q.cost)*pcs;
      }
    }

    q.purchaseUnitsPerPresentation=Number(q.purchaseUnitsPerPresentation||q.purchasePiecesPerUnit||1)||1;
    if(q.purchaseContentQty==null) q.purchaseContentQty=Number(q.purchaseUnitQty)||0;

    if(!Array.isArray(q.history)) q.history=[];
    return q;
  }

  function migrateLoza(q){
    q = q || {};
    q.qty = Number(q.qty)||0;
    q.unitCost = Number(q.unitCost)||0;
    if(q.targetQty !== '' && q.targetQty != null) q.targetQty = Number(q.targetQty);
    if(q.minStock !== '' && q.minStock != null) q.minStock = Number(q.minStock);
    if(!Array.isArray(q.history)) q.history=[];
    return q;
  }

  function normalize(s){
    return {
      categories:Array.isArray(s?.categories)?s.categories:[],
      suppliers:Array.isArray(s?.suppliers)?s.suppliers:[],
      products:Array.isArray(s?.products)?s.products.map(migrateProduct):[],
      orders:Array.isArray(s?.orders)?s.orders:[],
      counts:Array.isArray(s?.counts)?s.counts:[],
      recipes:Array.isArray(s?.recipes)?s.recipes:[],
      // IMPORTANTE: cualquier arreglo nuevo que se agregue a `state` en el
      // futuro (como este) DEBE listarse aquí explícitamente. normalize()
      // reconstruye el objeto `state` desde cero en cada carga y cada
      // sincronización en tiempo real — cualquier clave que no esté en esta
      // lista se BORRA silenciosamente, aunque el usuario la haya guardado
      // bien localmente. Este fue exactamente el bug que hizo que los
      // modos de stock "bodega"/"nivel" se revirtieran (ver inferMode).
      loza:Array.isArray(s?.loza)?s.loza.map(migrateLoza):[]
    };
  }

  function status(t,ok=false){
    window.panoramaCloudStatus=t;
    const e=document.getElementById('cloud-sync-status');
    if(e){e.textContent=t;e.className='badge'+(ok?' ok':'');}
  }

  function addSyncCard(){
    const holder=document.getElementById('install-card');
    if(!holder || document.getElementById('cloud-sync-card')) return;
    const c=document.createElement('div');
    c.className='card';
    c.id='cloud-sync-card';
    c.innerHTML='<h2>Sincronización entre dispositivos</h2><div class="card-sub">Una sola información para Panorama Inventario</div><div class="pill-row"><span id="cloud-sync-status" class="badge">Conectando…</span><button class="btn ghost small" id="btn-cloud-sync">↻ Sincronizar ahora</button></div>';
    holder.parentNode.insertBefore(c,holder);
    document.getElementById('btn-cloud-sync').onclick=syncNow;
  }

  async function loadRemote(){
    try{
      const {data,error}=await client.from(TABLE).select('data,updated_at').eq('id',ROW_ID).maybeSingle();
      if(error) throw error;
      if(data?.data){
        applyingRemote=true;
        state=normalize(data.data);
        lastUpdatedAt=data.updated_at||'';
        await storageSetValue(JSON.stringify(state));
        render();
        applyingRemote=false;
        return {found:true,error:false};
      }
      return {found:false,error:false};
    }catch(e){
      applyingRemote=false;
      status('No se pudo leer la nube; no se modificará',false);
      return {found:false,error:true};
    }
  }

  async function pushRemote(){
    if(!client||!ready||applyingRemote) return;
    try{
      const now=new Date().toISOString();
      const {data,error}=await client.from(TABLE).upsert({id:ROW_ID,data:state,updated_at:now},{onConflict:'id'}).select('updated_at').single();
      if(error) throw error;
      lastUpdatedAt=data?.updated_at||now;
      // El cambio local ya quedó confirmado en la nube: limpiar la bandera de pendiente.
      try{ localStorage.removeItem(LOCAL_KEY+'_pending'); }catch(e){}
      status('Sincronizado',true);
    }catch(e){
      status('Sin conexión — guardado local',false);
    }
  }

  function queue(){
    clearTimeout(timer);
    timer=setTimeout(pushRemote,350);
  }

  function subscribe(){
    if(channel) return;
    channel=client.channel('panorama-inventario-sync')
      .on('postgres_changes',{event:'*',schema:'public',table:TABLE,filter:'id=eq.main'},async payload=>{
        const r=payload.new;
        if(!r?.data || r.updated_at===lastUpdatedAt) return;
        applyingRemote=true;
        state=normalize(r.data);
        lastUpdatedAt=r.updated_at||'';
        await storageSetValue(JSON.stringify(state));
        render();
        applyingRemote=false;
        status('Actualizado en tiempo real',true);
      }).subscribe(s=>{
        if(s==='SUBSCRIBED') status('Sincronización en tiempo real activa',true);
      });
  }

  async function syncNow(){
    if(!client) return;

    // Si hay una edición local que se guardó pero nunca se confirmó que
    // llegara a Supabase (por ejemplo, se recargó la página justo después de
    // guardar, antes de que se cumplieran los 350ms de espera), esa edición
    // ya está en `state`/localStorage y es la fuente de verdad: hay que
    // subirla primero, NUNCA descargar la nube (vieja) y pisarla.
    let pending=false;
    try{ pending = localStorage.getItem(LOCAL_KEY+'_pending')==='1'; }catch(e){}
    if(pending){
      ready=true;
      await pushRemote();
      subscribe();
      status('Sincronización en tiempo real activa',true);
      return;
    }

    const result=await loadRemote();
    if(result.error) { ready=false; return; }
    ready=true;
    if(!result.found){
      await pushRemote();
    }
    subscribe();
    status('Sincronización en tiempo real activa',true);
  }

  function bindSaveNotification(){
    window.addEventListener('panorama:state-saved', queue);
  }


  async function init(){
    addSyncCard();
    if(!window.supabase){
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      await new Promise(resolve=>{
        s.onload=resolve;
        s.onerror=resolve;
        document.head.appendChild(s);
      });
    }
    if(!window.supabase){ status('Sin Supabase — guardado local',false); return; }

    client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
    bindSaveNotification();
    await syncNow();

    // Also normalize legacy data loaded locally when no cloud record exists.
    try{
      const before=JSON.stringify(state.products||[]);
      state=normalize(state);
      if(JSON.stringify(state.products||[])!==before){
        await storageSetValue(JSON.stringify(state));
        if(ready) await pushRemote();
        render();
      }
    }catch(e){}
  }

  setTimeout(init,0);
})();
