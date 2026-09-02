/* =====================================================================
   js/05-stock-conteo.js
   ---------------------------------------------------------------------
   Modelo de stock físico vs. unidad de costeo (bodega+uso, nivel, piezas, medida exacta) y Conteo físico de inventario

   Nota: este archivo NO es un módulo ES — es un script clásico que
   comparte el mismo scope global que el resto de js/*.js (igual que ya
   funcionaba sync.js). Debe cargarse en el orden indicado en index.html;
   varios archivos usan funciones/variables definidas en archivos
   anteriores de esta misma lista.
   ===================================================================== */

/* ---------------- Modelo separado: stock físico vs unidad de costeo ---------------- */
function unitConversion(from,to){
  const n=x=>String(x||'').trim().toLowerCase();
  const map={g:['mass',1],gramo:['mass',1],gramos:['mass',1],kg:['mass',1000],kilo:['mass',1000],lb:['mass',453.59237],libra:['mass',453.59237],oz:['vol',29.5735295625],onza:['mass',28.349523125],ml:['vol',1],mililitro:['vol',1],l:['vol',1000],litro:['vol',1000],pieza:['count',1],piezas:['count',1]};
  const a=map[n(from)],b=map[n(to)];
  return a&&b&&a[0]===b[0]?a[1]/b[1]:null;
}
function stockControlUnit(p){
  if(!p) return '';
  if(p.stockMode==='level' || p.stockMode==='warehouse') return '';
  return p.stockMode==='count' ? 'pieza' : (p.stockUnit||p.unit||'');
}
function stockLevelLabel(value){
  const n=Number(value);
  const labels={
    100:'Lleno — 100%',
    75:'¾ — 75%',
    50:'½ — 50%',
    25:'¼ — 25%',
    10:'Casi terminado — 10%',
    0:'Vacío — 0%'
  };
  return Number.isFinite(n) && Object.prototype.hasOwnProperty.call(labels,n)
    ? labels[n]
    : 'Sin definir';
}
function stockControlLabel(p){
  if(p?.stockMode==='warehouse') return `Bodega: ${Number(p.warehouseStock)||0} · En uso: ${stockLevelLabel(p.stockLevel??0)}`;
  if(p?.stockMode==='level') return stockLevelLabel(p.stockLevel);
  return `${Number(p?.stock)||0} ${stockControlUnit(p)}`;
}
function stockCostPerPhysicalUnit(p){
  if(!p || (p.stockMode!=='count' && p.stockMode!=='warehouse')) return Number(p?.cost)||0;
  const per=Number(p.purchaseContentQty)||0, from=p.purchaseContentUnit||p.unit||'';
  const target=p.unit||'';
  const conv=unitConversion(from,target);
  const usagePerPiece=conv===null ? per : per*conv;
  return usagePerPiece>0 ? (Number(p.cost)||0)*usagePerPiece : (Number(p.cost)||0);
}
function usageToPhysicalStock(p,usageQty){
  if(!p || (p.stockMode!=='count' && p.stockMode!=='warehouse')) return Number(usageQty)||0;
  const per=Number(p.purchaseContentQty)||0, from=p.purchaseContentUnit||p.unit||'';
  const conv=unitConversion(from,p.unit||'');
  const usagePerPiece=(conv===null?per:per*conv);
  return usagePerPiece>0 ? (Number(usageQty)||0)/usagePerPiece : 0;
}

/* ---------------- Conteo físico de inventario ---------------- */
function renderConteo(){
  let list = state.products.slice();
  if(ui.countFilterCat) list = list.filter(p=>p.categoryId===ui.countFilterCat);
  list.sort((a,b)=> a.name.localeCompare(b.name));

  const draftEntries = Object.keys(ui.countDraft).filter(id => ui.countDraft[id]!=='' && ui.countDraft[id]!=null);
  let varianceRows = [];
  let varianceValue = 0;

  draftEntries.forEach(id=>{
    const p = state.products.find(pp=>pp.id===id);
    if(!p) return;

    const counted = Number(ui.countDraft[id]);
    if(p.stockMode==='warehouse'){ const d=counted&&typeof ui.countDraft[id]==='object'?ui.countDraft[id]:{}; const bw=Number(d.warehouse); const bl=Number(d.level); if(!Number.isFinite(bw)||!Number.isFinite(bl)) return; const system=physicalStockEquivalent(p); const countedEq=bw+bl/100; const variance=countedEq-system; if(variance!==0){ varianceRows.push({p,variance,countedLabel:`Bodega: ${bw} · En uso: ${bl}%`, warehouse:bw, level:bl}); varianceValue+=variance*stockCostPerPhysicalUnit(p); }
    } else if(p.stockMode==='level'){
      const system = Number(p.stockLevel)||0;
      const variance = counted - system;
      if(variance!==0){
        varianceRows.push({p, variance, countedLabel: stockLevelLabel(counted)});
        varianceValue += (variance/100) * stockCostPerPhysicalUnit(p);
      }
    }else{
      const system = Number(p.stock)||0;
      const variance = counted - system;
      if(variance!==0){
        varianceRows.push({p, variance, countedLabel:`${counted} ${stockControlUnit(p)}`});
        varianceValue += variance * stockCostPerPhysicalUnit(p);
      }
    }
  });

  function countControl(p){
    const current = ui.countDraft[p.id];
    if(p.stockMode==='warehouse'){ const d=current&&typeof current==='object'?current:{}; return `<div style="display:flex;gap:6px;justify-content:flex-end;align-items:center"><input class="qty-input" style="width:70px !important" type="number" min="0" step="1" data-count-warehouse="${p.id}" value="${d.warehouse??''}" placeholder="Bod."><select class="count-level" data-count-warehouse-level="${p.id}"><option value="">Uso</option>${[100,75,50,25,10,0].map(v=>`<option value="${v}" ${String(d.level)===String(v)?'selected':''}>${v}%</option>`).join('')}</select></div>`; }
    if(p.stockMode==='level'){
      return `<select class="count-level" data-count-level="${p.id}">
        <option value="">—</option>
        <option value="100" ${String(current)==='100'?'selected':''}>Lleno — 100%</option>
        <option value="75" ${String(current)==='75'?'selected':''}>¾ — 75%</option>
        <option value="50" ${String(current)==='50'?'selected':''}>½ — 50%</option>
        <option value="25" ${String(current)==='25'?'selected':''}>¼ — 25%</option>
        <option value="10" ${String(current)==='10'?'selected':''}>Casi terminado — 10%</option>
        <option value="0" ${String(current)==='0'?'selected':''}>Vacío — 0%</option>
      </select>`;
    }
    const step = p.stockMode==='exact' ? 'any' : '1';
    return `<input class="qty-input" style="width:100px !important;" type="number" min="0" step="${step}" data-count-qty="${p.id}" value="${ui.countDraft[p.id]||''}" placeholder="—">`;
  }

  return `
    <div class="card">
      <div class="toolbar">
        <div>
          <h2 style="margin:0;">Conteo físico de inventario</h2>
          <div class="card-sub" style="margin-top:5px;">Esta pantalla sirve para hacer un inventario general. La captura cambia según cómo controles cada producto.</div>
        </div>
        <div class="filters">
          <select id="cnt-filter-cat"><option value="">Todas las categorías</option>${state.categories.map(c=>`<option value="${c.id}" ${ui.countFilterCat===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select>
        </div>
      </div>
      <div class="card-sub">
        <strong>Piezas/unidades:</strong> escribe cuántas tienes.
        <strong>Medición exacta:</strong> escribe lo que pesaste o mediste.
        <strong>Recipiente/nivel:</strong> selecciona el nivel que ves.
      </div>
      ${list.length===0 ? `<div class="empty">Agrega productos primero desde la pestaña Productos.</div>` : `
      <table>
        <thead><tr><th>Producto</th><th>Categoría</th><th class="num">Estado en sistema</th><th class="num">Conteo físico</th></tr></thead>
        <tbody>
        ${list.map(p=>`
          <tr>
            <td>${esc(p.name)}</td>
            <td>${esc(catName(p.categoryId))}</td>
            <td class="num">${stockControlLabel(p)}</td>
            <td class="num">${countControl(p)}</td>
          </tr>
        `).join('')}
        </tbody>
      </table>
      `}
    </div>

    ${varianceRows.length>0 ? `
    <div class="card">
      <h2>Diferencias encontradas</h2>
      <div class="card-sub">Revisa estas diferencias antes de aplicarlas.</div>
      <table>
        <thead><tr><th>Producto</th><th class="num">Sistema</th><th class="num">Contado</th><th class="num">Diferencia</th><th class="num">Impacto</th></tr></thead>
        <tbody>
        ${varianceRows.map(r=>{
          const diff = r.p.stockMode==='level'
            ? `${r.variance>0?'+':''}${r.variance} puntos`
            : `${r.variance>0?'+':''}${r.variance} ${stockControlUnit(r.p)}`;
          const impact = r.p.stockMode==='level'
            ? (r.variance/100)*stockCostPerPhysicalUnit(r.p)
            : r.variance*stockCostPerPhysicalUnit(r.p);
          return `<tr>
            <td>${esc(r.p.name)}</td>
            <td class="num">${esc(stockControlLabel(r.p))}</td>
            <td class="num">${esc(r.countedLabel)}</td>
            <td class="num ${r.variance<0?'delta-up':'delta-down'}">${diff}</td>
            <td class="num">${money(impact)}</td>
          </tr>`;
        }).join('')}
        </tbody>
      </table>
      <div style="text-align:right;font-family:'JetBrains Mono',monospace;margin-top:8px;">
        Impacto valorizado:
        <span style="font-weight:700;color:${varianceValue<0?'var(--rose)':'var(--mint)'};">${money(varianceValue)}</span>
      </div>
      <div class="field" style="margin-top:12px;"><label>Nota del conteo (opcional)</label><input id="cnt-note" placeholder="Ej. inventario semanal" value="${esc(ui.countNote||'')}"></div>
      <div class="modal-actions" style="justify-content:flex-start;">
        <button class="btn ghost" id="btn-cancel-count">Descartar</button>
        <button class="btn" id="btn-apply-count">Aplicar ajustes y guardar conteo</button>
      </div>
    </div>
    ` : (draftEntries.length>0 ? `<div class="card"><div class="empty" style="padding:16px;">Sin diferencias — el conteo coincide con el sistema.</div></div>` : '')}

    ${state.counts.length>0 ? `
    <div class="card">
      <h2>Conteos anteriores</h2>
      <table><thead><tr><th>Fecha</th><th>Nota</th><th class="num">Productos con diferencia</th><th class="num">Impacto</th></tr></thead>
      <tbody>
      ${state.counts.slice().reverse().map(c=>`<tr><td>${c.date}</td><td>${esc(c.note||'—')}</td><td class="num">${c.items.length}</td><td class="num">${money(c.value)}</td></tr>`).join('')}
      </tbody></table>
    </div>
    ` : ''}
  `;
}

