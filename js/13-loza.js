/* =====================================================================
   js/13-loza.js
   ---------------------------------------------------------------------
   Inventario de Loza / cristalería (vasos, platos, cubiertos, etc.)

   Módulo INDEPENDIENTE a propósito: usa su propio arreglo `state.loza`,
   nunca toca `state.products` ni `state.categories`/`state.suppliers`, y
   no participa en la Lista de compra de insumos. Responde a tres
   necesidades: 1) cuánto tienes ahora, 2) historial de cuánto tuviste
   antes (para roturas/pérdidas), y 3) presupuesto de reposición.

   Nota: este archivo NO es un módulo ES — es un script clásico que
   comparte el mismo scope global que el resto de js/*.js (igual que ya
   funcionaba sync.js). Debe cargarse en el orden indicado en index.html;
   varios archivos usan funciones/variables definidas en archivos
   anteriores de esta misma lista.
   ===================================================================== */

/* ---------------- Helpers ---------------- */
function lozaValue(){
  return state.loza.reduce((s,i)=> s + (Number(i.qty)||0) * (Number(i.unitCost)||0), 0);
}
function lozaFaltante(item){
  const t = Number(item.targetQty);
  if(!Number.isFinite(t)) return 0;
  return Math.max(0, t - (Number(item.qty)||0));
}
function lozaBudgetTotal(){
  return state.loza.reduce((s,i)=> s + lozaFaltante(i) * (Number(i.unitCost)||0), 0);
}
function lozaTypes(){
  const set = new Set();
  state.loza.forEach(i=>{ if(i.tipo && i.tipo.trim()) set.add(i.tipo.trim()); });
  return Array.from(set).sort((a,b)=>a.localeCompare(b));
}
const LOZA_REASON_LABELS = { alta:'Alta inicial', compra:'Compra nueva', rota:'Se rompió / dañó', perdida:'Se perdió / robo', conteo:'Corrección de conteo' };

/* ---------------- Tab: Loza ---------------- */
function renderLoza(){
  let list = state.loza.slice();
  if(ui.lozaSearch){
    const q = ui.lozaSearch.toLowerCase();
    list = list.filter(i=> i.name.toLowerCase().includes(q) || (i.tipo||'').toLowerCase().includes(q));
  }
  list.sort((a,b)=> a.name.localeCompare(b.name));

  const totalPiezas = state.loza.reduce((s,i)=> s + (Number(i.qty)||0), 0);
  const totalValor = lozaValue();
  const budget = lozaBudgetTotal();
  const needing = state.loza.filter(i=> lozaFaltante(i) > 0);

  return `
    <div class="grid-stats">
      <div class="stat"><div class="num">${state.loza.length}</div><div class="label">Artículos distintos</div></div>
      <div class="stat"><div class="num mint">${totalPiezas}</div><div class="label">Piezas totales</div></div>
      <div class="stat"><div class="num">${money(totalValor)}</div><div class="label">Valor del inventario de loza</div></div>
      <div class="stat"><div class="num ${budget>0?'rose':''}">${money(budget)}</div><div class="label">Presupuesto de reposición</div></div>
    </div>

    <div class="card">
      <div class="toolbar">
        <h2 style="margin:0;">Loza y cristalería</h2>
        <button class="btn" id="btn-new-loza">+ Nuevo artículo</button>
      </div>
      <div class="toolbar">
        <div class="filters">
          <input id="f-loza-search" placeholder="Buscar por nombre o tipo..." value="${esc(ui.lozaSearch||'')}">
        </div>
        <div class="pill-row">
          <button class="btn ghost small" id="btn-export-loza-excel">⬇ Excel</button>
          <button class="btn ghost small" id="btn-export-loza-pdf">⬇ PDF</button>
        </div>
      </div>
      ${list.length===0 ? `
        <div class="empty">
          <div class="em-title">Aún no hay artículos de loza registrados</div>
          <div>Agrega vasos, platos, tazas, cristalería, cubiertos... Este inventario es independiente del de insumos.</div>
        </div>
      ` : `
      <div class="table-scroll">
      <table>
        <thead><tr>
          <th>Artículo</th><th>Tipo</th><th class="num">Costo unit.</th><th class="num">Cantidad actual</th>
          <th class="num">Valor</th><th class="num">Objetivo</th><th>Estado</th><th>Acciones</th>
        </tr></thead>
        <tbody>
        ${list.map(i=>{
          const falt = lozaFaltante(i);
          const low = i.minStock!=='' && i.minStock!=null && Number(i.qty)<=Number(i.minStock);
          return `<tr>
            <td>${esc(i.name)}</td>
            <td>${i.tipo? esc(i.tipo) : '<span style="color:var(--chalk-faint);">—</span>'}</td>
            <td class="num">${money(i.unitCost)}</td>
            <td class="num">${Number(i.qty)||0}</td>
            <td class="num">${money((Number(i.qty)||0)*(Number(i.unitCost)||0))}</td>
            <td class="num">${i.targetQty===''||i.targetQty==null ? '<span style="color:var(--chalk-faint);">—</span>' : (falt>0 ? `${i.targetQty} <span style="color:var(--rose); font-size:0.75rem;">(faltan ${falt})</span>` : i.targetQty)}</td>
            <td>${low? '<span class="badge low">bajo</span>' : '<span class="badge ok">ok</span>'}</td>
            <td class="row-actions">
              <button class="icon-btn" data-action="loza-adjust" data-id="${i.id}">🔧 Ajuste puntual</button>
              <button class="icon-btn" data-action="loza-history" data-id="${i.id}">☰ Historial</button>
              <button class="icon-btn" data-action="loza-edit" data-id="${i.id}">✎ Editar</button>
              <button class="icon-btn danger" data-action="loza-delete" data-id="${i.id}">✕ Eliminar</button>
            </td>
          </tr>
          ${ui.lozaExpandedHistory===i.id ? `<tr><td colspan="8">${renderLozaHistoryPanel(i)}</td></tr>` : ''}
          `;
        }).join('')}
        </tbody>
      </table>
      </div>
      `}
    </div>

    ${needing.length ? `
    <div class="card" style="border-left:4px solid var(--rose);">
      <h2>Presupuesto sugerido de reposición</h2>
      <div class="card-sub">Artículos por debajo de su cantidad objetivo, y cuánto costaría completarlos</div>
      <div class="table-scroll">
      <table>
        <thead><tr><th>Artículo</th><th class="num">Tienes</th><th class="num">Objetivo</th><th class="num">Faltan</th><th class="num">Costo unit.</th><th class="num">Inversión</th></tr></thead>
        <tbody>
        ${needing.map(i=>{
          const falt = lozaFaltante(i);
          return `<tr><td>${esc(i.name)}</td><td class="num">${Number(i.qty)||0}</td><td class="num">${i.targetQty}</td><td class="num">${falt}</td><td class="num">${money(i.unitCost)}</td><td class="num">${money(falt*(Number(i.unitCost)||0))}</td></tr>`;
        }).join('')}
        </tbody>
        <tfoot><tr><td colspan="5" style="font-weight:700;">Total a invertir</td><td class="num" style="font-weight:700;">${money(budget)}</td></tr></tfoot>
      </table>
      </div>
    </div>
    ` : `
    <div class="card">
      <h2>Presupuesto de reposición</h2>
      <div class="card-sub">Al editar un artículo, define su "cantidad objetivo" (cuántos deberías tener) y aquí te calculará automáticamente cuánto invertir en reponer lo que falte.</div>
    </div>
    `}
  `;
}

function renderLozaHistoryPanel(item){
  const hist = (item.history||[]).slice().sort((a,b)=> (b.date||'').localeCompare(a.date||'') || (b.id||'').localeCompare(a.id||''));
  if(hist.length===0) return `<div class="empty" style="padding:12px;">Sin historial todavía.</div>`;
  // Reconstruye cuántas piezas había DESPUÉS de cada movimiento, partiendo
  // de la cantidad actual y restando hacia atrás — así se puede ver
  // "cuántos tuve" en cualquier punto del pasado.
  let running = Number(item.qty)||0;
  let rows = '';
  for(let i=0;i<hist.length;i++){
    const h = hist[i];
    const after = running;
    running -= (Number(h.qty)||0);
    const typeLabel = LOZA_REASON_LABELS[h.type] ? `· ${LOZA_REASON_LABELS[h.type]}` : '';
    const qtyStr = h.qty ? ' · ' + (h.qty>0?'+':'') + h.qty : '';
    rows += `<div class="hist-item">
      <div class="h-left">${h.date} ${h.note? '· '+esc(h.note):''} ${typeLabel}</div>
      <div class="h-right">${qtyStr} → quedaron ${after}</div>
    </div>`;
  }
  return `<div style="background:var(--board-3); border-radius:8px; padding:12px 16px;"><div class="card-sub" style="margin-bottom:8px;">Historial de cantidades — ${esc(item.name)}</div>${rows}</div>`;
}

/* ---------------- Formulario: alta / edición de artículo ---------------- */
function openLozaForm(item){
  const isEdit = !!item;
  item = item || {id:null, name:'', tipo:'', unitCost:0, qty:0, targetQty:'', minStock:''};
  const types = lozaTypes();

  openModal(`
    <h3>${isEdit?'Editar artículo de loza':'Nuevo artículo de loza'}</h3>
    <div class="field"><label>Nombre</label><input id="lf-name" value="${esc(item.name)}" placeholder="Ej. Vaso alto vidrio 12oz"></div>
    <div class="field-row">
      <div class="field">
        <label>Tipo (opcional)</label>
        <input id="lf-tipo" list="lf-tipo-list" value="${esc(item.tipo||'')}" placeholder="Ej. Vasos, Cristalería, Platos...">
        <datalist id="lf-tipo-list">${types.map(t=>`<option value="${esc(t)}">`).join('')}</datalist>
      </div>
      <div class="field"><label>Costo unitario</label><input id="lf-cost" type="number" min="0" step="0.01" value="${item.unitCost||0}"></div>
    </div>
    <div class="field-row">
      <div class="field">
        <label>${isEdit?'Cantidad actual':'Cantidad inicial'}</label>
        <input id="lf-qty" type="number" min="0" step="1" value="${item.qty||0}" ${isEdit?'disabled':''}>
      </div>
      <div class="field"><label>Cantidad objetivo (opcional)</label><input id="lf-target" type="number" min="0" step="1" value="${item.targetQty===''||item.targetQty==null?'':item.targetQty}" placeholder="¿Cuántos deberías tener?"></div>
    </div>
    <div class="field"><label>Stock mínimo de alerta (opcional)</label><input id="lf-min" type="number" min="0" step="1" value="${item.minStock===''||item.minStock==null?'':item.minStock}"></div>
    ${isEdit ? `<div class="card-sub" style="margin-top:-6px;">Para cambiar la cantidad actual usa "Ajuste puntual" en la tabla — así queda registrado en el historial.</div>` : ''}
    <div class="modal-actions">
      <button class="btn ghost" id="lf-cancel">Cancelar</button>
      <button class="btn" id="lf-save">${isEdit?'Guardar':'Crear'}</button>
    </div>
  `);
  document.getElementById('lf-cancel').onclick = closeModal;
  document.getElementById('lf-save').onclick = ()=>{
    const name = document.getElementById('lf-name').value.trim();
    if(!name){ showToast('El nombre es obligatorio'); return; }
    const tipo = document.getElementById('lf-tipo').value.trim();
    const unitCost = Number(document.getElementById('lf-cost').value)||0;
    const targetRaw = document.getElementById('lf-target').value;
    const targetQty = targetRaw==='' ? '' : Number(targetRaw);
    const minRaw = document.getElementById('lf-min').value;
    const minStock = minRaw==='' ? '' : Number(minRaw);

    if(isEdit){
      item.name = name; item.tipo = tipo; item.unitCost = unitCost;
      item.targetQty = targetQty; item.minStock = minStock;
    } else {
      const qty = Math.max(0, Number(document.getElementById('lf-qty').value)||0);
      state.loza.push({
        id: uid('lz'), name, tipo, unitCost, qty, targetQty, minStock,
        history: [{ id: uid('h'), date: todayStr(), type:'alta', qty, note:'Alta inicial' }]
      });
    }
    saveState(); closeModal(); render();
  };
}

/* ---------------- Formulario: ajuste puntual (compra, rotura, pérdida, conteo) ---------------- */
function openLozaAdjustForm(item){
  openModal(`
    <h3>Ajuste puntual — ${esc(item.name)}</h3>
    <div class="card-sub">Cantidad actual: ${Number(item.qty)||0}</div>
    <div class="field"><label>Motivo</label>
      <select id="la-reason">
        <option value="compra">Compra nueva</option>
        <option value="rota">Se rompió / dañó</option>
        <option value="perdida">Se perdió / robo</option>
        <option value="conteo">Corrección de conteo</option>
      </select>
    </div>
    <div class="field-row">
      <div class="field"><label>Tipo de movimiento</label>
        <select id="la-dir">
          <option value="1">Sumar</option>
          <option value="-1">Restar</option>
        </select>
      </div>
      <div class="field"><label>Cantidad</label><input id="la-qty" type="number" min="0" step="1" value="0"></div>
    </div>
    <div class="field"><label>Fecha</label><input id="la-date" type="date" value="${todayStr()}"></div>
    <div class="field"><label>Nota (opcional)</label><input id="la-note" placeholder="Detalle adicional..."></div>
    <div class="modal-actions">
      <button class="btn ghost" id="la-cancel">Cancelar</button>
      <button class="btn" id="la-save">Registrar ajuste</button>
    </div>
  `);
  document.getElementById('la-cancel').onclick = closeModal;
  document.getElementById('la-save').onclick = ()=>{
    const reason = document.getElementById('la-reason').value;
    const dir = Number(document.getElementById('la-dir').value);
    const qty = Number(document.getElementById('la-qty').value)||0;
    const date = document.getElementById('la-date').value || todayStr();
    const note = document.getElementById('la-note').value.trim();
    if(qty<=0){ showToast('Ingresa una cantidad mayor a 0'); return; }
    const delta = dir*qty;
    if(delta<0 && Math.abs(delta) > (Number(item.qty)||0)){
      showToast('No puedes restar más piezas de las que tienes'); return;
    }
    const reasonLabel = LOZA_REASON_LABELS[reason] || reason;
    item.history = item.history || [];
    item.history.push({ id: uid('h'), date, type: reason, qty: delta, note: note ? `${reasonLabel} — ${note}` : reasonLabel });
    item.qty = (Number(item.qty)||0) + delta;
    saveState(); closeModal(); render(); showToast('Ajuste registrado');
  };
}

/* ---------------- Exportar: Excel y PDF (independientes del Excel de insumos) ---------------- */
function exportLozaExcel(){
  if(typeof XLSX === 'undefined'){ showToast('No se pudo cargar el módulo de Excel'); return; }
  if(state.loza.length===0){ showToast('Aún no hay artículos de loza para exportar'); return; }

  const wb = XLSX.utils.book_new();

  const rows = state.loza.map(i=>({
    'Artículo': i.name,
    'Tipo': i.tipo||'',
    'Costo unitario': i.unitCost||0,
    'Cantidad actual': i.qty||0,
    'Valor actual': (Number(i.qty)||0)*(Number(i.unitCost)||0),
    'Cantidad objetivo': i.targetQty===''||i.targetQty==null ? '' : i.targetQty,
    'Faltan para objetivo': lozaFaltante(i),
    'Inversión para completar': lozaFaltante(i)*(Number(i.unitCost)||0),
    'Stock mínimo': i.minStock===''||i.minStock==null ? '' : i.minStock
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Loza');

  const histRows = [];
  state.loza.forEach(i=>{
    (i.history||[]).forEach(h=> histRows.push({
      'Artículo': i.name, 'Fecha': h.date, 'Tipo': LOZA_REASON_LABELS[h.type]||h.type,
      'Cantidad': h.qty||'', 'Nota': h.note||''
    }));
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(histRows), 'Historial Loza');

  XLSX.writeFile(wb, `loza_panorama_cafe_${todayStr()}.xlsx`);
}

function exportLozaPDF(){
  if(typeof window.jspdf === 'undefined'){ showToast('No se pudo cargar el módulo de PDF'); return; }
  if(state.loza.length===0){ showToast('Aún no hay artículos de loza para exportar'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  pdfHeader(doc, 'Inventario de loza y cristalería', todayStr());

  const sorted = state.loza.slice().sort((a,b)=>a.name.localeCompare(b.name));
  const body = sorted.map(i=>[
    i.name, i.tipo||'—', String(Number(i.qty)||0), money(i.unitCost),
    money((Number(i.qty)||0)*(Number(i.unitCost)||0))
  ]);
  doc.autoTable({
    startY: 34,
    head: [['Artículo','Tipo','Cantidad','Costo unit.','Valor']],
    body,
    styles:{fontSize:9, cellPadding:3},
    headStyles:{fillColor:[169,118,15]},
    margin:{left:14,right:14}
  });

  let y = doc.lastAutoTable.finalY + 8;
  doc.setFont('helvetica','bold'); doc.setFontSize(10);
  doc.text(`Valor total del inventario: ${money(lozaValue())}`, 14, y);

  const needing = state.loza.filter(i=>lozaFaltante(i)>0);
  if(needing.length){
    y += 8;
    doc.text('Presupuesto sugerido de reposición', 14, y);
    const budgetBody = needing.map(i=>{
      const falt = lozaFaltante(i);
      return [i.name, String(Number(i.qty)||0), String(i.targetQty), String(falt), money(falt*(Number(i.unitCost)||0))];
    });
    doc.autoTable({
      startY: y+4,
      head: [['Artículo','Tienes','Objetivo','Faltan','Inversión']],
      body: budgetBody,
      styles:{fontSize:9, cellPadding:3},
      headStyles:{fillColor:[169,118,15]},
      margin:{left:14,right:14}
    });
    const finalY = doc.lastAutoTable.finalY + 6;
    doc.setFont('helvetica','bold');
    doc.text(`Total a invertir: ${money(lozaBudgetTotal())}`, 14, finalY);
  }

  doc.save(`loza_panorama_cafe_${todayStr()}.pdf`);
}
