/* =====================================================================
   js/01-storage.js
   ---------------------------------------------------------------------
   Estado global, persistencia (localStorage / Claude storage) y helpers genéricos de datos (uid, esc, money, fechas, etc.)

   Nota: este archivo NO es un módulo ES — es un script clásico que
   comparte el mismo scope global que el resto de js/*.js (igual que ya
   funcionaba sync.js). Debe cargarse en el orden indicado en index.html;
   varios archivos usan funciones/variables definidas en archivos
   anteriores de esta misma lista.
   ===================================================================== */

/* ---------------- Estado y persistencia ----------------
   Se guarda directamente en el dispositivo (localStorage) para que funcione
   sin conexión al abrir la app como PWA instalada. Si se ejecuta dentro de
   Claude.ai como artefacto, usa el almacenamiento de Claude en su lugar. */
const STORAGE_KEY = 'data';
const LOCAL_KEY = 'panorama_cafe_inventario_' + STORAGE_KEY;
const useClaudeStorage = (typeof window.storage !== 'undefined');

let state = { categories: [], suppliers: [], products: [], orders: [], counts: [], recipes: [], loza: [] };
let ui = { tab: 'dashboard', filterCat: '', filterSup: '', filterBrand: '', search: '', purchase: {}, expandedHistory: null, countDraft: {}, countFilterCat: '', countNote: '', lozaSearch: '', lozaExpandedHistory: null };

function uid(prefix){ return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function todayStr(){ return new Date().toISOString().slice(0,10); }
function money(n){ n = Number(n)||0; return '$' + n.toLocaleString('es-MX', {minimumFractionDigits:2, maximumFractionDigits:2}); }
function unitCostMoney(n){
  n = Number(n);
  if(!Number.isFinite(n)) return '$0.00';
  if(n === 0) return '$0.00';
  // Show enough precision for recipe/unit costs without turning normal prices into long decimals.
  const abs=Math.abs(n);
  let digits = abs >= 1 ? 2 : abs >= 0.1 ? 3 : abs >= 0.01 ? 5 : abs >= 0.001 ? 6 : 8;
  return '$' + n.toLocaleString('es-MX',{minimumFractionDigits:digits,maximumFractionDigits:digits});
}

async function storageGetValue(){
  if(useClaudeStorage){
    const res = await window.storage.get(STORAGE_KEY, false);
    return res && res.value ? res.value : null;
  }
  try{ return localStorage.getItem(LOCAL_KEY); }catch(e){ return null; }
}

async function storageSetValue(value){
  if(useClaudeStorage){
    await window.storage.set(STORAGE_KEY, value, false);
    return;
  }
  localStorage.setItem(LOCAL_KEY, value);
}

async function loadState(){
  try{
    const raw = await storageGetValue();
    if(raw){
      state = JSON.parse(raw);
      state.categories = state.categories || [];
      state.suppliers = state.suppliers || [];
      state.products = state.products || [];
      state.orders = state.orders || [];
      state.counts = state.counts || [];
      state.recipes = state.recipes || [];
      state.loza = state.loza || [];
    }
  }catch(e){
    // no existing data yet
  }
  render();
}

const PENDING_SYNC_KEY = LOCAL_KEY + '_pending';
let saveTimer = null;
function saveState(){
  // Marcar de inmediato (sin debounce) que hay un cambio local sin confirmar
  // en la nube. Si la página se recarga antes de que Supabase reciba el
  // cambio, esta bandera evita que sync.js descargue la versión vieja de la
  // nube y borre la edición que ya está en localStorage.
  try{ localStorage.setItem(PENDING_SYNC_KEY, '1'); }catch(e){}
  // Fuente única de guardado: persistencia local y notificación de sincronización.
  try{ window.dispatchEvent(new CustomEvent('panorama:state-saved')); }catch(e){}
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async ()=>{
    try{
      await storageSetValue(JSON.stringify(state));
    }catch(e){
      console.error('Error guardando', e);
      showToast('No se pudo guardar. Intenta de nuevo.');
    }
  }, 150);
}

function showToast(msg){
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(()=> el.remove(), 2200);
}

/* ---------------- Helpers de datos ---------------- */
function catName(id){ const c = state.categories.find(c=>c.id===id); return c ? c.name : 'Sin categoría'; }
function supName(id){ const s = state.suppliers.find(s=>s.id===id); return s ? s.name : 'Sin proveedor'; }
function productsBySupplier(supId){ return state.products.filter(p=>p.supplierId===supId); }
function productsByCategory(catId){ return state.products.filter(p=>p.categoryId===catId); }
function physicalStockEquivalent(p){ if(p?.stockMode==='warehouse') return (Number(p.warehouseStock)||0)+(Number(p.stockLevel)||0)/100; if(p?.stockMode==='level') return (Number(p.stockLevel)||0)/100; return Number(p?.stock)||0; }
function inventoryValue(){ return state.products.reduce((sum,p)=> sum + physicalStockEquivalent(p) * stockCostPerPhysicalUnit(p), 0); }
function lowStockProducts(){ return state.products.filter(p => { if(p.stockMode==='warehouse'){ const min=Number(p.minStock); return physicalStockEquivalent(p) <= (Number.isFinite(min)&&p.minStock!==''&&p.minStock!=null ? min : 0); } return (p.minStock!=='' && p.minStock!=null && p.stockMode!=='level' && Number(p.stock) <= Number(p.minStock)); }); }

