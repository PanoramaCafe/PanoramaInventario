/* =====================================================================
   js/03-catalogo.js
   ---------------------------------------------------------------------
   Listados y acciones de Productos, Categorías y Proveedores

   Nota: este archivo NO es un módulo ES — es un script clásico que
   comparte el mismo scope global que el resto de js/*.js (igual que ya
   funcionaba sync.js). Debe cargarse en el orden indicado en index.html;
   varios archivos usan funciones/variables definidas en archivos
   anteriores de esta misma lista.
   ===================================================================== */

/* ---------------- Productos ---------------- */
function uniqueBrands(){
  const set = new Set();
  state.products.forEach(p=>{ if(p.brand && p.brand.trim()) set.add(p.brand.trim()); });
  return Array.from(set).sort((a,b)=>a.localeCompare(b));
}

function renderProductos(){
  let list = state.products.slice();
  if(ui.filterCat) list = list.filter(p=>p.categoryId===ui.filterCat);
  if(ui.filterSup) list = list.filter(p=>p.supplierId===ui.filterSup);
  if(ui.filterBrand) list = list.filter(p=>(p.brand||'')===ui.filterBrand);
  if(ui.search) list = list.filter(p=>p.name.toLowerCase().includes(ui.search.toLowerCase()) || (p.brand||'').toLowerCase().includes(ui.search.toLowerCase()));
  list.sort((a,b)=> a.name.localeCompare(b.name));

  const brands = uniqueBrands();

  return `
    <div class="card">
      <div class="toolbar">
        <h2 style="margin:0;">Productos</h2>
        <button class="btn" id="btn-new-product">+ Nuevo producto</button>
      </div>
      <div class="toolbar">
        <div class="filters">
          <input id="f-search" placeholder="Buscar por nombre o marca..." value="${esc(ui.search)}">
          <select id="f-cat"><option value="">Todas las categorías</option>${state.categories.map(c=>`<option value="${c.id}" ${ui.filterCat===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select>
          <select id="f-sup"><option value="">Todos los proveedores</option>${state.suppliers.map(s=>`<option value="${s.id}" ${ui.filterSup===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select>
          ${brands.length ? `<select id="f-brand"><option value="">Todas las marcas</option>${brands.map(b=>`<option value="${esc(b)}" ${ui.filterBrand===b?'selected':''}>${esc(b)}</option>`).join('')}</select>` : ''}
        </div>
      </div>
      ${list.length===0 ? `
        <div class="empty">
          <div class="em-title">Aún no hay productos aquí</div>
          <div>Agrega tu primer producto para empezar a llevar el inventario.</div>
        </div>
      ` : `
      <div class="table-scroll">
      <table>
        <thead><tr>
          <th>Producto</th><th>Marca</th><th>Categoría</th><th>Proveedor</th>
          <th class="num">Costo actual</th><th class="num">Stock</th><th>Estado</th><th>Acciones</th>
        </tr></thead>
        <tbody>
        ${list.map(p=>{
          const low = p.stockMode!=='level' && p.minStock!=='' && p.minStock!=null && Number(p.stock)<=Number(p.minStock);
          const hasPU = p.purchaseUnit && Number(p.purchaseUnitQty)>0;
          return `<tr>
            <td>${esc(p.name)}</td>
            <td>${p.brand? esc(p.brand) : '<span style="color:var(--chalk-faint);">—</span>'}</td>
            <td>${esc(catName(p.categoryId))}</td>
            <td>${esc(supName(p.supplierId))}</td>
            <td class="num">${unitCostMoney(p.cost)} <span style="color:var(--chalk-faint); font-size:0.75rem;">/${esc(p.unit||'u')}</span></td>
            <td class="num">${stockControlLabel(p)}${hasPU && p.stockMode==='exact'? `<div style="font-size:0.7rem; color:var(--chalk-faint);">≈ ${(Number(p.stock)/Number(p.purchaseUnitQty)).toFixed(1)} ${esc(p.purchaseUnit)}</div>` : ''}</td>
            <td>${low? '<span class="badge low">bajo</span>' : '<span class="badge ok">ok</span>'}</td>
            <td class="row-actions">
              <button class="icon-btn" data-action="restock" data-id="${p.id}">🛒 Registrar compra</button>
              <button class="icon-btn" data-action="adjust" data-id="${p.id}">🔧 Ajuste puntual</button>
              <button class="icon-btn" data-action="history" data-id="${p.id}">☰ Historial</button>
              <button class="icon-btn" data-action="edit-product" data-id="${p.id}">✎ Editar</button>
              <button class="icon-btn danger" data-action="delete-product" data-id="${p.id}">✕ Eliminar</button>
            </td>
          </tr>
          ${ui.expandedHistory===p.id ? `<tr><td colspan="8">${renderHistoryPanel(p)}</td></tr>` : ''}
          `;
        }).join('')}
        </tbody>
      </table>
      </div>
      `}
    </div>
  `;
}

function renderHistoryPanel(p){
  const hist = (p.history||[]).slice().sort((a,b)=> (b.date||'').localeCompare(a.date||''));
  if(hist.length===0) return `<div class="empty" style="padding:12px;">Sin historial todavía.</div>`;
  let rows = '';
  for(let i=0;i<hist.length;i++){
    const h = hist[i];
    let deltaHtml = '';
    if(h.cost!=null){
      const prev = hist.slice(i+1).find(x=>x.cost!=null);
      if(prev){
        const diff = h.cost - prev.cost;
        if(diff>0) deltaHtml = `<span class="delta-up"> ▲ ${money(diff)}</span>`;
        else if(diff<0) deltaHtml = `<span class="delta-down"> ▼ ${money(Math.abs(diff))}</span>`;
      }
    }
    const typeLabel = {ajuste:'· ajuste de stock', conteo:'· conteo físico', produccion:'· producción/receta'}[h.type] || '';
    const qtyStr = h.qty ? ' · ' + (h.qty>0?'+':'') + h.qty + ' ' + esc(stockControlUnit(p)||'') : '';
    rows += `<div class="hist-item">
      <div class="h-left">${h.date} ${h.note? '· '+esc(h.note):''} ${typeLabel}</div>
      <div class="h-right">${h.cost!=null? money(h.cost)+deltaHtml : ''}${qtyStr}</div>
    </div>`;
  }
  return `<div style="background:var(--board-3); border-radius:8px; padding:12px 16px;"><div class="card-sub" style="margin-bottom:8px;">Historial de costos e inventario — ${esc(p.name)}</div>${rows}</div>`;
}

/* ---------------- Categorías ---------------- */
function renderCategorias(){
  return `
    <div class="card">
      <div class="toolbar">
        <h2 style="margin:0;">Categorías</h2>
        <button class="btn" id="btn-new-cat">+ Nueva categoría</button>
      </div>
      ${state.categories.length===0 ? `
        <div class="empty"><div class="em-title">Sin categorías todavía</div><div>Crea categorías como "Café en grano", "Lácteos", "Panadería"...</div></div>
      ` : `
      <table><thead><tr><th>Nombre</th><th class="num">Productos</th><th></th></tr></thead>
      <tbody>
      ${state.categories.map(c=>`
        <tr>
          <td>${esc(c.name)}</td>
          <td class="num">${productsByCategory(c.id).length}</td>
          <td class="row-actions">
            <button class="icon-btn" data-action="edit-cat" data-id="${c.id}">✎ Editar</button>
            <button class="icon-btn danger" data-action="delete-cat" data-id="${c.id}">✕ Eliminar</button>
          </td>
        </tr>
      `).join('')}
      </tbody></table>
      `}
    </div>
  `;
}

/* ---------------- Proveedores ---------------- */
function renderProveedores(){
  return `
    <div class="card">
      <div class="toolbar">
        <h2 style="margin:0;">Proveedores</h2>
        <button class="btn" id="btn-new-sup">+ Nuevo proveedor</button>
      </div>
      ${state.suppliers.length===0 ? `
        <div class="empty"><div class="em-title">Sin proveedores todavía</div><div>Agrega proveedores para poder agrupar tus listas de compra.</div></div>
      ` : `
      <table><thead><tr><th>Nombre</th><th>Contacto</th><th class="num">Productos</th><th></th></tr></thead>
      <tbody>
      ${state.suppliers.map(s=>`
        <tr>
          <td>${esc(s.name)}</td>
          <td>${esc(s.contact||'—')}</td>
          <td class="num">${productsBySupplier(s.id).length}</td>
          <td class="row-actions">
            <button class="icon-btn" data-action="edit-sup" data-id="${s.id}">✎ Editar</button>
            <button class="icon-btn danger" data-action="delete-sup" data-id="${s.id}">✕ Eliminar</button>
          </td>
        </tr>
      `).join('')}
      </tbody></table>
      `}
    </div>
  `;
}

