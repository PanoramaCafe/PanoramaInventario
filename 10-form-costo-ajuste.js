/* =====================================================================
   js/10-form-costo-ajuste.js
   ---------------------------------------------------------------------
   Formulario para registrar nuevo costo/mercancía y formulario de ajuste de stock (merma, daño, uso interno)

   Nota: este archivo NO es un módulo ES — es un script clásico que
   comparte el mismo scope global que el resto de js/*.js (igual que ya
   funcionaba sync.js). Debe cargarse en el orden indicado en index.html;
   varios archivos usan funciones/variables definidas en archivos
   anteriores de esta misma lista.
   ===================================================================== */

/* ---------------- Formulario: registrar nuevo costo / mercancía ---------------- */
function openRestockForm(product){
  const hasPurchaseUnit = product.purchaseUnit && Number(product.purchaseUnitQty) > 0;
  const physicalUnitsPerPurchase = Number(product.purchaseUnitsPerPresentation||product.purchasePiecesPerUnit||product.purchaseUnitQty)||1;
  openModal(`
    <h3>Nuevo costo / mercancía — ${esc(product.name)}</h3>
    <div class="card-sub">Costo actual: ${unitCostMoney(product.cost)}/${esc(product.unit||'u')} · Stock actual: ${stockControlLabel(product)}</div>
    ${hasPurchaseUnit ? `
    <div class="field"><label>¿Cómo vas a registrar la entrada?</label>
      <select id="rf-mode">
        <option value="unit">Por ${esc(product.unit||'unidad')} (unidad de uso)</option>
        <option value="purchase">Por ${esc(product.purchaseUnit)} (contiene ${product.purchaseUnitQty} ${esc(product.unit||'')} c/u)</option>
      </select>
    </div>
    ` : ''}
    <div id="rf-unit-fields" class="field-row">
      <div class="field"><label>Nuevo costo por ${esc(product.unit||'unidad')}</label><input id="rf-cost" type="number" step="any" value="${product.cost}"></div>
      <div class="field"><label>Cantidad recibida (${esc(product.unit||'unidad')})</label><input id="rf-qty" type="number" step="any" value="0"></div>
    </div>
    <div id="rf-purchase-fields" class="field-row" style="display:none;">
      <div class="field"><label>Costo por ${esc(product.purchaseUnit||'')}</label><input id="rf-pcost" type="number" step="any" value=""></div>
      <div class="field"><label>${esc(product.purchaseUnit||'')}s recibidas</label><input id="rf-pqty" type="number" step="any" value="0"></div>
    </div>
    <div id="rf-conversion-preview" class="card-sub" style="display:none;"></div>
    <div class="field"><label>Fecha</label><input id="rf-date" type="date" value="${todayStr()}"></div>
    <div class="field"><label>Nota (opcional)</label><input id="rf-note" placeholder="Ej. compra mensual, ajuste de proveedor..."></div>
    <div class="modal-actions">
      <button class="btn ghost" id="rf-cancel">Cancelar</button>
      <button class="btn" id="rf-save">Registrar</button>
    </div>
  `);

  const modeSelect = document.getElementById('rf-mode');
  const unitFields = document.getElementById('rf-unit-fields');
  const purchaseFields = document.getElementById('rf-purchase-fields');
  const preview = document.getElementById('rf-conversion-preview');

  function updateMode(){
    const mode = modeSelect ? modeSelect.value : 'unit';
    if(mode === 'purchase'){
      unitFields.style.display = 'none';
      purchaseFields.style.display = 'grid';
      preview.style.display = 'block';
      updatePreview();
    } else {
      unitFields.style.display = 'grid';
      purchaseFields.style.display = 'none';
      preview.style.display = 'none';
    }
  }
  function updatePreview(){
    const pcost = Number(document.getElementById('rf-pcost').value)||0;
    const pqty = Number(document.getElementById('rf-pqty').value)||0;
    const per = Number(product.purchaseUnitQty)||1;
    const contentQty = Number(product.purchaseContentQty)||0;
    const contentUnit = product.purchaseContentUnit || product.unit || '';
    const conversion = unitConversion(contentUnit, product.unit || '');
    const usagePerPiece = contentQty>0 ? (conversion===null ? contentQty : contentQty*conversion) : 0;
    const usagePerPresentation = Number(product.purchaseUnitsPerPresentation||product.purchasePiecesPerUnit||0)>0
      ? Number(product.purchaseUnitsPerPresentation||product.purchasePiecesPerUnit) * usagePerPiece
      : (usagePerPiece>0 ? physicalUnitsPerPurchase*usagePerPiece : per);
    const totalUnits = pqty*per;
    const stockUnits = product.stockMode==='count' ? pqty*physicalUnitsPerPurchase : totalUnits;
    const unitCost = usagePerPresentation>0 ? pcost/usagePerPresentation : (per>0 ? pcost/per : 0);
    preview.innerHTML = `= ${stockUnits} ${esc(stockControlUnit(product)||product.unit||'')} entran al inventario · costo por ${esc(product.unit||'unidad')}: ${money(unitCost)}`;
  }
  if(modeSelect){
    modeSelect.onchange = updateMode;
    document.getElementById('rf-pcost').oninput = updatePreview;
    document.getElementById('rf-pqty').oninput = updatePreview;
  }

  document.getElementById('rf-cancel').onclick = closeModal;
  document.getElementById('rf-save').onclick = ()=>{
    const date = document.getElementById('rf-date').value || todayStr();
    const note = document.getElementById('rf-note').value.trim();
    const mode = modeSelect ? modeSelect.value : 'unit';
    let cost, qty;
    if(mode === 'purchase'){
      const pcost = Number(document.getElementById('rf-pcost').value);
      const pqty = Number(document.getElementById('rf-pqty').value)||0;
      const per = Number(product.purchaseUnitQty)||1;
      const contentQty = Number(product.purchaseContentQty)||0;
      const contentUnit = product.purchaseContentUnit || product.unit || '';
      const conversion = unitConversion(contentUnit, product.unit || '');
      const usagePerPiece = contentQty>0 ? (conversion===null ? contentQty : contentQty*conversion) : 0;
      const unitsPerPresentation = Number(product.purchaseUnitsPerPresentation||product.purchasePiecesPerUnit||0);
      const usagePerPresentation = unitsPerPresentation>0 && usagePerPiece>0
        ? unitsPerPresentation*usagePerPiece
        : (usagePerPiece>0 ? physicalUnitsPerPurchase*usagePerPiece : per);
      if(isNaN(pcost)){ showToast(`Ingresa el costo por ${product.purchaseUnit}`); return; }
      cost = usagePerPresentation>0 ? pcost/usagePerPresentation : (per>0 ? pcost/per : pcost);
      qty = product.stockMode==='count' ? pqty*physicalUnitsPerPurchase : pqty*per;
      const noteWithPurchase = `${pqty} ${product.purchaseUnit}(s) de ${money(pcost)} c/u` + (note? ' — '+note : '');
      product.history = product.history || [];
      product.history.push({ id: uid('h'), date, type:'costo', cost, qty, note: noteWithPurchase });
    } else {
      cost = Number(document.getElementById('rf-cost').value);
      qty = Number(document.getElementById('rf-qty').value)||0;
      if(isNaN(cost)){ showToast('Ingresa un costo válido'); return; }
      product.history = product.history || [];
      product.history.push({ id: uid('h'), date, type:'costo', cost, qty, note });
    }
    product.cost = cost;
    // Las compras nuevas de Bodega + En uso siempre entran cerradas a Bodega.
    if(product.stockMode==='warehouse'){ const added = mode==='purchase' ? (Number(document.getElementById('rf-pqty').value)||0) : (Number(document.getElementById('rf-qty').value)||0); product.warehouseStock=(Number(product.warehouseStock)||0)+added; } else { product.stock = (Number(product.stock)||0) + qty; }
    saveState(); closeModal(); render();
  };
}

/* ---------------- Formulario: ajustar stock (merma, daño, uso interno...) ---------------- */
function openAdjustStockForm(product){
  openModal(`
    <h3>Ajuste puntual — ${esc(product.name)}</h3>
    <div class="card-sub">Stock actual: ${stockControlLabel(product)}</div>
    <div class="field"><label>Motivo</label>
      <select id="af-reason">
        <option value="Merma">Merma</option>
        <option value="Daño">Daño</option>
        <option value="Robo o pérdida">Robo o pérdida</option>
        <option value="Uso interno">Uso interno</option>
        <option value="Corrección de conteo">Corrección de conteo</option>
        <option value="Otro">Otro</option>
      </select>
    </div>
    ${product.stockMode==='warehouse' ? `<div class="field-row"><div class="field"><label>Bodega</label><input id="af-warehouse" type="number" min="0" step="1" value="${Number(product.warehouseStock)||0}"></div><div class="field"><label>En uso</label><select id="af-level">${[100,75,50,25,10,0].map(v=>`<option value="${v}" ${Number(product.stockLevel)===v?'selected':''}>${stockLevelLabel(v)}</option>`).join('')}</select></div></div>` : `<div class="field-row">
      <div class="field"><label>Tipo de movimiento</label>
        <select id="af-dir">
          <option value="-1">Restar del stock</option>
          <option value="1">Sumar al stock</option>
        </select>
      </div>
      <div class="field"><label>Cantidad</label><input id="af-qty" type="number" min="0" step="any" value="0"></div>
    </div>`}
    <div class="field"><label>Fecha</label><input id="af-date" type="date" value="${todayStr()}"></div>
    <div class="field"><label>Nota (opcional)</label><input id="af-note" placeholder="Detalle adicional..."></div>
    <div class="modal-actions">
      <button class="btn ghost" id="af-cancel">Cancelar</button>
      <button class="btn" id="af-save">Registrar ajuste</button>
    </div>
  `);
  document.getElementById('af-cancel').onclick = closeModal;
  document.getElementById('af-save').onclick = ()=>{
    const reason = document.getElementById('af-reason').value;
    if(product.stockMode==='warehouse'){ const bw=Number(document.getElementById('af-warehouse').value), bl=Number(document.getElementById('af-level').value); if(!Number.isFinite(bw)||!Number.isFinite(bl)||bw<0){showToast('Revisa el stock físico');return;} const prev=physicalStockEquivalent(product), next=bw+bl/100; product.history=product.history||[]; product.history.push({id:uid('h'),date:document.getElementById('af-date').value||todayStr(),type:'ajuste',cost:null,qty:next-prev,note:`${reason} — Bodega ${bw}, En uso ${bl}%`+(document.getElementById('af-note').value.trim()?' — '+document.getElementById('af-note').value.trim():'')}); product.warehouseStock=bw; product.stockLevel=bl; saveState(); closeModal(); render(); showToast('Ajuste registrado'); return; }
    const dir = Number(document.getElementById('af-dir').value);
    const qty = Number(document.getElementById('af-qty').value)||0;
    const date = document.getElementById('af-date').value || todayStr();
    const note = document.getElementById('af-note').value.trim();
    if(qty<=0){ showToast('Ingresa una cantidad mayor a 0'); return; }
    const delta = dir*qty;
    const applyAdjustment = ()=>{
      product.history = product.history || [];
      product.history.push({ id: uid('h'), date, type:'ajuste', cost:null, qty: delta, note: reason + (note? ' — '+note : '') });
      product.stock = (Number(product.stock)||0) + delta;
      saveState(); closeModal(); render();
      showToast('Ajuste registrado');
    };
    if(delta<0 && Number(product.stock)+delta<0){
      openConfirmModal('El stock quedaría en negativo. ¿Continuar de todas formas?', applyAdjustment, 'Sí, continuar');
    } else {
      applyAdjustment();
    }
  };
}

