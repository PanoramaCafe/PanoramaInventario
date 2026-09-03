/* =====================================================================
   js/07-compras.js
   ---------------------------------------------------------------------
   Compatibilidad de presentaciones de compra y Lista de compra sugerida
   ===================================================================== */
function normalizePurchasePresentation(p){
  if(!p) return p;
  if(p.purchaseUnitsPerPresentation==null || p.purchaseUnitsPerPresentation===''){
    const legacy=Number(p.purchasePiecesPerUnit)||0;
    const fallback=(p.purchaseUnit && Number(p.purchaseUnitQty)>0 && Number(p.purchaseContentQty)>0)
      ? Number(p.purchaseUnitQty)/Number(p.purchaseContentQty) : 0;
    if(legacy>0) p.purchaseUnitsPerPresentation=legacy;
    else if(fallback>0) p.purchaseUnitsPerPresentation=fallback;
  }
  if((p.purchaseContentQty==null || p.purchaseContentQty==='') && p.purchaseUnit && Number(p.purchaseUnitQty)>0){
    p.purchaseContentQty=Number(p.purchaseUnitQty);
    p.purchaseContentUnit=p.purchaseContentUnit||p.unit||'';
    p.purchaseUnitsPerPresentation=Number(p.purchaseUnitsPerPresentation)||1;
  }
  return p;
}
function orderUnit(p){
  normalizePurchasePresentation(p);
  return (p.purchaseUnit && (Number(p.purchaseUnitsPerPresentation)||Number(p.purchaseUnitQty)||0)>0)
    ? p.purchaseUnit : (p.unit||'u');
}
function orderUnitCost(p){
  normalizePurchasePresentation(p);
  const purchasePrice=Number(p.purchasePrice);
  if(Number.isFinite(purchasePrice) && purchasePrice>0) return purchasePrice;
  return (p.purchaseUnit && Number(p.purchaseUnitQty)>0)
    ? (Number(p.cost)||0)*Number(p.purchaseUnitQty) : (Number(p.cost)||0);
}
function orderEquivalent(p,qty){
  normalizePurchasePresentation(p);
  const q=Number(qty)||0;if(!q)return '';
  const unitsPerPresentation=Number(p.purchaseUnitsPerPresentation)||Number(p.purchasePiecesPerUnit)||0;
  const contentPerUnit=Number(p.purchaseContentQty)||0;
  const contentUnit=p.purchaseContentUnit||p.unit||'';
  const parts=[];
  if(unitsPerPresentation>0) parts.push(`${q*unitsPerPresentation} ${esc(p.stockUnit||'pieza')}${q*unitsPerPresentation===1?'':'s'}`);
  if(unitsPerPresentation>0&&contentPerUnit>0) parts.push(`${q*unitsPerPresentation*contentPerUnit} ${esc(contentUnit)}`);
  return parts.length?`<div style="font-size:0.68rem;color:var(--chalk-faint);margin-top:2px;">= ${parts.join(' · ')}</div>`:'';
}

// Ajusta rápidamente la cantidad de compra en pasos de una presentación.
// Se mantiene el scroll para que sea cómodo en tablet y móvil.
function changePurchaseQty(id,delta){
  const current=Number(ui.purchase[id])||0;
  const next=Math.max(0,current+delta);
  ui.purchase[id]=String(next);
  if(typeof renderConteoPreservePosition==='function'){
    renderConteoPreservePosition(`[data-purchase-qty="${id}"]`);
  }else{
    render();
  }
}

function renderCompra(){
  const selectedIds=Object.keys(ui.purchase).filter(id=>Number(ui.purchase[id])>0);
  const grouped={};
  selectedIds.forEach(id=>{
    const p=state.products.find(pp=>pp.id===id);if(!p)return;
    const supId=p.supplierId||'none';grouped[supId]=grouped[supId]||[];grouped[supId].push(p);
  });
  const grandTotal=selectedIds.reduce((sum,id)=>{
    const p=state.products.find(pp=>pp.id===id);if(!p)return sum;
    return sum+(Number(ui.purchase[id])||0)*orderUnitCost(p);
  },0);

  return `
    <div class="card">
      <h2>Armar lista de compra</h2>
      <div class="card-sub">Indica la cantidad a comprar de cada producto — en la unidad en la que se lo pides a tu proveedor (caja, si la definiste; si no, en la unidad de uso). Se agrupará por proveedor.</div>
      ${state.products.length===0?`<div class="empty">Agrega productos primero desde la pestaña Productos.</div>`:`
      <table>
        <thead><tr><th>Producto</th><th>Proveedor</th><th class="num">Costo por unidad de pedido</th><th class="num">Cantidad a pedir</th></tr></thead>
        <tbody>
        ${state.products.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(p=>{
          const equivalent=orderEquivalent(p,ui.purchase[p.id]);
          const qty=ui.purchase[p.id]||'';
          return `
          <tr>
            <td>${esc(p.name)}${p.brand?` <span style="color:var(--chalk-faint);font-size:0.78rem;">(${esc(p.brand)})</span>`:''}</td>
            <td>${esc(supName(p.supplierId))}</td>
            <td class="num">${money(orderUnitCost(p))}/${esc(orderUnit(p))}</td>
            <td class="num">
              <div style="display:inline-flex;align-items:center;gap:6px;vertical-align:middle;">
                <button type="button" class="btn ghost small" style="width:44px;height:44px;padding:0;font-size:1.25rem;line-height:1;" aria-label="Disminuir cantidad" onclick="changePurchaseQty('${p.id}',-1)">−</button>
                <input class="qty-input" style="width:72px !important;text-align:center;" type="number" min="0" step="any" data-purchase-qty="${p.id}" value="${qty}" placeholder="0" aria-label="Cantidad a pedir">
                <button type="button" class="btn ghost small" style="width:44px;height:44px;padding:0;font-size:1.25rem;line-height:1;" aria-label="Aumentar cantidad" onclick="changePurchaseQty('${p.id}',1)">+</button>
              </div>
              <span style="font-size:0.75rem;color:var(--chalk-faint);margin-left:4px;">${esc(orderUnit(p))}</span>${equivalent}
            </td>
          </tr>`;
        }).join('')}
        </tbody>
      </table>`}
    </div>

    ${selectedIds.length>0?`
    <div class="card">
      <div class="toolbar"><h2 style="margin:0;">Resumen por proveedor</h2><div>
        <button class="btn ghost" id="btn-export-all">Descargar CSV completo</button>
        <button class="btn ghost" id="btn-export-all-pdf">Descargar PDF completo</button>
        <button class="btn" id="btn-save-order">Guardar pedido</button>
      </div></div>
      ${Object.keys(grouped).map(supId=>{
        const items=grouped[supId];
        const subtotal=items.reduce((s,p)=>s+(Number(ui.purchase[p.id])||0)*orderUnitCost(p),0);
        const name=supId==='none'?'Sin proveedor asignado':supName(supId);
        return `<div class="supplier-group"><div class="sg-head"><div class="sg-name">${esc(name)}</div><div style="display:flex;align-items:center;gap:10px;"><div class="sg-total">${money(subtotal)}</div><button class="btn ghost small" data-action="export-supplier" data-sup="${supId}">CSV</button><button class="btn ghost small" data-action="export-supplier-pdf" data-sup="${supId}">PDF</button><button class="btn ghost small" data-action="copy-supplier" data-sup="${supId}">Copiar texto</button></div></div><table><thead><tr><th>Producto</th><th class="num">Cant.</th><th class="num">Costo unit.</th><th class="num">Subtotal</th></tr></thead><tbody>${items.map(p=>`<tr><td>${esc(p.name)}${p.brand?` <span style="color:var(--chalk-faint);font-size:0.78rem;">(${esc(p.brand)})</span>`:''}</td><td class="num">${ui.purchase[p.id]} ${esc(orderUnit(p))}</td><td class="num">${money(orderUnitCost(p))}</td><td class="num">${money((Number(ui.purchase[p.id])||0)*orderUnitCost(p))}</td></tr>`).join('')}</tbody></table></div>`;
      }).join('')}
      <div style="text-align:right;font-family:'JetBrains Mono',monospace;font-size:1.1rem;padding-top:6px;">Presupuesto total: <span style="color:var(--gold);font-weight:700;">${money(grandTotal)}</span></div>
    </div>`:''}

    ${state.orders.length>0?`<div class="card"><h2>Pedidos guardados</h2><div class="card-sub">Historial de listas de compra generadas</div><table><thead><tr><th>Fecha</th><th class="num">Artículos</th><th class="num">Total</th><th></th></tr></thead><tbody>${state.orders.slice().reverse().map(o=>`<tr><td>${o.date}</td><td class="num">${o.items.length}</td><td class="num">${money(o.total)}</td><td class="row-actions"><button class="icon-btn" data-action="download-order-pdf" data-id="${o.id}">⬇ PDF</button><button class="icon-btn danger" data-action="delete-order" data-id="${o.id}">✕ Eliminar</button></td></tr>`).join('')}</tbody></table></div>`:''}
  `;
}
