/* =====================================================================
   js/02-render.js
   ---------------------------------------------------------------------
   Render principal (router de pestañas) y Dashboard

   Nota: este archivo NO es un módulo ES — es un script clásico que
   comparte el mismo scope global que el resto de js/*.js (igual que ya
   funcionaba sync.js). Debe cargarse en el orden indicado en index.html;
   varios archivos usan funciones/variables definidas en archivos
   anteriores de esta misma lista.
   ===================================================================== */

/* ---------------- Render principal ---------------- */
const app = document.getElementById('app');

function render(){
  app.innerHTML = `
    <header class="top">
      <h1><span class="dot"></span>Panorama Café · Inventario</h1>
      <div class="sub">${state.products.length} productos · ${state.suppliers.length} proveedores · valor: ${money(inventoryValue())}</div>
    </header>
    <div class="ticket-divider"></div>
    <nav class="tabs">
      ${tabBtn('dashboard','Resumen')}
      ${tabBtn('productos','Productos')}
      ${tabBtn('categorias','Categorías')}
      ${tabBtn('proveedores','Proveedores')}
      ${tabBtn('conteo','Conteo de inventario')}
      ${tabBtn('recetas','Recetas / Producción')}
      ${tabBtn('compra','Lista de compra')}
      ${tabBtn('loza','Loza')}
      ${tabBtn('datos','Datos y app')}
    </nav>
    <div id="tab-content"></div>
    <footer class="note">Los datos se guardan automáticamente en este navegador.</footer>
  `;
  const content = document.getElementById('tab-content');
  if(ui.tab==='dashboard') content.innerHTML = renderDashboard();
  if(ui.tab==='productos') content.innerHTML = renderProductos();
  if(ui.tab==='categorias') content.innerHTML = renderCategorias();
  if(ui.tab==='proveedores') content.innerHTML = renderProveedores();
  if(ui.tab==='conteo') content.innerHTML = renderConteo();
  if(ui.tab==='recetas') content.innerHTML = renderRecetas();
  if(ui.tab==='compra') content.innerHTML = renderCompra();
  if(ui.tab==='loza') content.innerHTML = renderLoza();
  if(ui.tab==='datos') content.innerHTML = renderDatos();
  attachGlobalEvents();
}

function tabBtn(key,label){
  return `<button data-tab="${key}" class="${ui.tab===key?'active':''}">${label}</button>`;
}

/* ---------------- Dashboard ---------------- */
function renderDashboard(){
  const low = lowStockProducts();
  const recentHistory = [];
  state.products.forEach(p=>{
    (p.history||[]).forEach(h=> recentHistory.push({...h, productName:p.name}));
  });
  recentHistory.sort((a,b)=> (b.date||'').localeCompare(a.date||''));
  const last5 = recentHistory.slice(0,6);

  return `
    <div class="grid-stats">
      <div class="stat"><div class="num">${money(inventoryValue())}</div><div class="label">Valor total del inventario</div></div>
      <div class="stat"><div class="num mint">${state.products.length}</div><div class="label">Productos registrados</div></div>
      <div class="stat"><div class="num ${low.length? 'rose':''}">${low.length}</div><div class="label">Con stock bajo</div></div>
      <div class="stat"><div class="num">${state.suppliers.length}</div><div class="label">Proveedores</div></div>
    </div>

    <div class="card">
      <h2>Stock bajo</h2>
      <div class="card-sub">Productos en o por debajo de su mínimo definido</div>
      ${low.length ? `
        <table><thead><tr><th>Producto</th><th>Categoría</th><th>Proveedor</th><th class="num">Stock</th><th class="num">Mínimo</th></tr></thead>
        <tbody>
        ${low.map(p=>`<tr><td>${esc(p.name)}</td><td>${esc(catName(p.categoryId))}</td><td>${esc(supName(p.supplierId))}</td><td class="num">${stockControlLabel(p)}</td><td class="num">${p.stockMode==='level'?'—':`${p.minStock} ${stockControlUnit(p)}`}</td></tr>`).join('')}
        </tbody></table>
      ` : `<div class="empty" style="padding:16px;">Todo en orden — nada por debajo del mínimo.</div>`}
    </div>

    <div class="card">
      <h2>Últimos movimientos de costo / inventario</h2>
      <div class="card-sub">Registros más recientes en todos los productos</div>
      ${last5.length ? last5.map(h=>{
        const typeLabel = {ajuste:'· ajuste de stock', conteo:'· conteo físico', produccion:'· producción/receta', costo:'· nuevo costo/mercancía'}[h.type] || '';
        const qtyStr = h.qty ? ' · ' + (h.qty>0?'+':'') + h.qty : '';
        return `
        <div class="hist-item">
          <div class="h-left">${h.date} · ${esc(h.productName)} ${typeLabel}</div>
          <div class="h-right">${h.cost!=null ? money(h.cost) : ''}${qtyStr}</div>
        </div>
      `;}).join('') : `<div class="empty" style="padding:16px;">Aún no hay movimientos registrados.</div>`}
    </div>

    ${renderCategoryValuationCard()}
  `;
}

function renderCategoryValuationCard(){
  const totalVal = inventoryValue();
  const cats = state.categories.slice().sort((a,b)=>a.name.localeCompare(b.name));
  const rows = cats.map(c=>{
    const items = productsByCategory(c.id);
    const val = items.reduce((s,p)=> s + (Number(p.stock)||0)*stockCostPerPhysicalUnit(p), 0);
    return { name: c.name, count: items.length, val };
  });
  const uncategorized = state.products.filter(p=>!p.categoryId);
  if(uncategorized.length){
    const val = uncategorized.reduce((s,p)=> s + (Number(p.stock)||0)*stockCostPerPhysicalUnit(p), 0);
    rows.push({ name:'Sin categoría', count: uncategorized.length, val });
  }
  rows.sort((a,b)=> b.val - a.val);
  return `
    <div class="card">
      <h2>Valoración de inventario por categoría</h2>
      <div class="card-sub">Cuánto capital tienes invertido en cada categoría</div>
      ${rows.length===0 ? `<div class="empty" style="padding:16px;">Agrega categorías y productos para ver este desglose.</div>` : `
      <table>
        <thead><tr><th>Categoría</th><th class="num">Productos</th><th class="num">Valor</th><th class="num">% del total</th></tr></thead>
        <tbody>
        ${rows.map(r=>`<tr><td>${esc(r.name)}</td><td class="num">${r.count}</td><td class="num">${money(r.val)}</td><td class="num">${totalVal>0 ? ((r.val/totalVal)*100).toFixed(1) : '0.0'}%</td></tr>`).join('')}
        </tbody>
        <tfoot><tr><td style="font-weight:700;">Total</td><td></td><td class="num" style="font-weight:700;">${money(totalVal)}</td><td class="num" style="font-weight:700;">100%</td></tr></tfoot>
      </table>
      `}
    </div>
  `;
}

