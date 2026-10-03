/* =====================================================================
   js/09-form-producto.js
   ---------------------------------------------------------------------
   Formulario de alta/edición de producto (incluye lógica de "¿cómo lo compras?" y modos de stock)

   Nota: este archivo NO es un módulo ES — es un script clásico que
   comparte el mismo scope global que el resto de js/*.js (igual que ya
   funcionaba sync.js). Debe cargarse en el orden indicado en index.html;
   varios archivos usan funciones/variables definidas en archivos
   anteriores de esta misma lista.
   ===================================================================== */

/* ---------------- Formularios: producto ---------------- */
function openProductForm(product){
  const isEdit = !!product;
  product = product || {
    id:null,name:'',brand:'',categoryId:'',supplierId:'',unit:'',
    purchaseUnit:'',purchaseUnitQty:'',purchaseUnitsPerPresentation:'',
    purchasePiecesPerUnit:'',purchaseContentQty:'',purchaseContentUnit:'',
    purchasePrice:'',cost:'',stock:0,stockLevel:'',minStock:'',
    stockMode:'count',stockUnit:'pieza'
  };
  const mode = product.stockMode || 'count';
  const stockUnit = mode==='count' ? 'pieza' : (product.stockUnit || product.unit || '');

  openModal(`
    <h3>${isEdit?'Editar producto':'Nuevo producto'}</h3>

    <div class="field-row">
      <div class="field"><label>Nombre</label><input id="pf-name" value="${esc(product.name)}" placeholder="Ej. Carne arrachera"></div>
      <div class="field"><label>Marca (opcional)</label><input id="pf-brand" list="brand-suggestions" value="${esc(product.brand||'')}" placeholder="Ej. Members Mark, Bachoco..."><datalist id="brand-suggestions">${uniqueBrands().map(b=>`<option value="${esc(b)}">`).join('')}</datalist></div>
    </div>

    <div class="field-row">
      <div class="field"><label>Categoría</label><select id="pf-cat">${categoryOptions(product.categoryId)}</select></div>
      <div class="field"><label>Proveedor</label><select id="pf-sup">${supplierOptions(product.supplierId)}</select></div>
    </div>

    <div class="field-row">
      <div class="field"><label>Unidad de uso / costeo</label><input id="pf-unit" value="${esc(product.unit||'')}" placeholder="ml, g, oz..."></div>
      <div class="field">
        <label>¿Cómo controlas el stock?</label>
        <select id="pf-stock-mode">
          <option value="count" ${mode==='count'?'selected':''}>Por piezas / unidades</option>
          <option value="exact" ${mode==='exact'?'selected':''}>Por medida exacta</option>
          <option value="warehouse" ${mode==='warehouse'?'selected':''}>Bodega + En uso</option>
          <option value="level" ${mode==='level'?'selected':''}>Recipiente / nivel aproximado</option>
        </select>
      </div>
    </div>

    <div class="field-row" id="pf-stock-row">
      <div class="field">
        <label id="pf-stock-unit-label">Unidad de stock</label>
        <input id="pf-stock-unit" value="${esc(stockUnit)}" ${mode==='count'?'readonly':''}>
      </div>
      <div class="field">
        <label>Stock mínimo (opcional)</label>
        <input id="pf-min" type="number" step="any" value="${product.minStock??''}">
      </div>
    </div>

    <!-- Control físico específico para Bodega + En uso. -->
    <div id="pf-warehouse-row" class="card" style="padding:14px;margin:8px 0;background:var(--board-3);display:none;">
      <h2 style="font-size:1rem;margin-bottom:6px;">📦 Stock físico: Bodega + En uso</h2>
      <div class="card-sub">Las presentaciones nuevas y cerradas permanecen en bodega. Solo un recipiente puede estar abierto para uso.</div>
      <div class="field-row" style="margin-top:10px;">
        <div class="field">
          <label>Presentaciones completas en bodega</label>
          <input id="pf-warehouse-stock" type="number" min="0" step="1" value="${Number(product.warehouseStock)||0}" placeholder="Ej. 2">
        </div>
        <div class="field">
          <label>Recipiente en uso</label>
          <select id="pf-warehouse-level">
            <option value="100">Lleno — 100%</option>
            <option value="75">¾ — 75%</option>
            <option value="50">½ — 50%</option>
            <option value="25">¼ — 25%</option>
            <option value="10">Casi terminado — 10%</option>
            <option value="0">Vacío — 0%</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Este bloque permanece dentro del formulario principal y se muestra
         cuando el control físico es por nivel. -->
    <div id="pf-level-row" class="card" style="padding:14px;margin:8px 0;background:var(--board-3);display:none;">
      <h2 style="font-size:1rem;margin-bottom:6px;">📊 Nivel físico actual</h2>
      <div class="card-sub">Aquí indicas cuánto producto queda en el recipiente. No necesitas pesar ni medir.</div>
      <div class="field" style="margin-bottom:0;">
        <label>¿Cuánto tienes actualmente?</label>
        <select id="pf-level">
          <option value="">Selecciona un nivel…</option>
          <option value="100">Lleno — 100%</option>
          <option value="75">¾ — 75%</option>
          <option value="50">½ — 50%</option>
          <option value="25">¼ — 25%</option>
          <option value="10">Casi terminado — 10%</option>
          <option value="0">Vacío — 0%</option>
        </select>
      </div>
    </div>

    <div class="card-sub" style="margin-top:2px;"><strong>¿Cómo lo compras?</strong> — estos datos permiten calcular automáticamente el costo por ${esc(product.unit||'unidad de uso')}.</div>

    <div class="field-row">
      <div class="field"><label>Se compra en</label><input id="pf-punit" value="${esc(product.purchaseUnit||'')}" placeholder="Ej. Caja, Paquete, Bote..."></div>
      <div class="field"><label>Precio que pagas por esa presentación</label><input id="pf-price" type="number" min="0" step="any" value="${product.purchasePrice??''}" placeholder="Ej. 299"></div>
    </div>

    <div class="field-row">
      <div class="field"><label>¿Cuántas unidades contiene?</label><input id="pf-units" type="number" min="1" step="any" value="${product.purchaseUnitsPerPresentation??product.purchasePiecesPerUnit??product.purchaseUnitQty??''}" placeholder="Ej. 12"></div>
      <div class="field"><label>Contenido de cada unidad</label><input id="pf-content-qty" type="number" min="0" step="any" value="${product.purchaseContentQty??''}" placeholder="Ej. 1"></div>
    </div>

    <div class="field-row">
      <div class="field"><label>Unidad del contenido</label><select id="pf-content-unit"><option value="pieza">pieza</option><option value="g">g</option><option value="kg">kg</option><option value="ml">ml</option><option value="L">L</option><option value="oz">oz</option></select></div>
      <div class="field"><label>Costo calculado por unidad de uso</label><input id="pf-cost" type="number" step="any" value="${product.cost||''}" readonly></div>
    </div>

    <div id="pf-cost-preview" class="card-sub" style="margin-top:4px;"></div>

    ${!isEdit ? `
    <div class="field-row" id="pf-initial-stock-row">
      <div class="field">
        <label id="pf-stock-label">Stock inicial (${esc(stockUnit||product.unit||'unidad')})</label>
        <input id="pf-stock" type="number" step="any" value="${product.stock}">
      </div>
      <div class="field">
        <label id="pf-initial-level-label">Nivel inicial</label>
        <select id="pf-initial-level">
          <option value="">Selecciona un nivel…</option>
          <option value="100">Lleno — 100%</option>
          <option value="75">¾ — 75%</option>
          <option value="50">½ — 50%</option>
          <option value="25">¼ — 25%</option>
          <option value="10">Casi terminado — 10%</option>
          <option value="0">Vacío — 0%</option>
        </select>
      </div>
    </div>` : `<div class="card-sub">Para cambiar el costo usa "Costo/mercancía". Para cambiar el stock físico usa "Ajustar stock" o, en nivel aproximado, este selector.</div>`}

    <div class="modal-actions"><button class="btn ghost" id="pf-cancel">Cancelar</button><button class="btn" id="pf-save">${isEdit?'Guardar cambios':'Crear producto'}</button></div>
  `);

  const levelValues = {100:'Lleno — 100%',75:'¾ — 75%',50:'½ — 50%',25:'¼ — 25%',10:'Casi terminado — 10%',0:'Vacío — 0%'};
  const updateStockUI=()=>{
    const m=document.getElementById('pf-stock-mode').value;
    const unitEl=document.getElementById('pf-stock-unit');
    const row=document.getElementById('pf-stock-row');
    const levelRow=document.getElementById('pf-level-row');
    const warehouseRow=document.getElementById('pf-warehouse-row');
    const levelEl=document.getElementById('pf-level');
    const initialStock=document.getElementById('pf-stock');
    const initialLevel=document.getElementById('pf-initial-level');
    const initialRow=document.getElementById('pf-initial-stock-row');

    if(m==='count'){
      unitEl.value='pieza'; unitEl.readOnly=true; row.style.display='grid';
      if(levelRow) levelRow.style.display='none'; if(warehouseRow) warehouseRow.style.display='none';
      if(initialStock){ initialStock.style.display='block'; }
      if(initialLevel){ initialLevel.style.display='none'; }
      const lab=document.getElementById('pf-stock-label'); if(lab) lab.textContent='Stock inicial (pieza)';
      return;
    }

    if(m==='exact'){
      unitEl.readOnly=false; row.style.display='grid';
      if(!unitEl.value) unitEl.value=document.getElementById('pf-unit').value.trim();
      if(levelRow) levelRow.style.display='none'; if(warehouseRow) warehouseRow.style.display='none';
      if(initialStock) initialStock.style.display='block';
      if(initialLevel) initialLevel.style.display='none';
      const lab=document.getElementById('pf-stock-label'); if(lab) lab.textContent='Stock inicial ('+(unitEl.value||document.getElementById('pf-unit').value||'unidad')+')';
      return;
    }

    if(m==='warehouse'){
      unitEl.value='presentación'; unitEl.readOnly=true; row.style.display='none';
      if(warehouseRow) warehouseRow.style.display='block';
      if(levelRow) levelRow.style.display='none';
      if(initialRow) initialRow.style.display='none';
      const warehouseLevel=document.getElementById('pf-warehouse-level');
      if(warehouseLevel) warehouseLevel.value = product.stockLevel==='' || product.stockLevel==null ? '0' : String(product.stockLevel);
      return;
    }

    // nivel aproximado
    unitEl.value='%'; unitEl.readOnly=true; row.style.display='none';
    if(levelRow) levelRow.style.display='block';
    if(levelEl) levelEl.value = product.stockLevel==='' || product.stockLevel==null ? '' : String(product.stockLevel);
    if(initialStock) initialStock.style.display='none';
    if(initialLevel) initialLevel.style.display='block';
  };

  const setSelect=(id,v)=>{
    const e=document.getElementById(id);
    if(e && v!=null && v!=='') e.value=String(v);
  };
  setSelect('pf-content-unit', product.purchaseContentUnit||product.unit||'pieza');
  setSelect('pf-level', product.stockLevel);
  setSelect('pf-warehouse-level', product.stockLevel===''||product.stockLevel==null?0:product.stockLevel);
  setSelect('pf-initial-level', product.stockLevel);

  document.getElementById('pf-stock-mode').onchange=updateStockUI;
  document.getElementById('pf-stock-mode').addEventListener('change',updateStockUI);
  document.getElementById('pf-unit').addEventListener('input',updateStockUI);
  updateStockUI();

  const unitFactor=(from,to)=>{
    const map={ml:['vol',1],l:['vol',1000],litro:['vol',1000],L:['vol',1000],g:['mass',1],kg:['mass',1000],oz:['vol',29.5735295625],onza:['vol',29.5735295625],pieza:['count',1],piezas:['count',1]};
    const a=map[String(from||'').trim()],b=map[String(to||'').trim()];
    return a&&b&&a[0]===b[0]?a[1]/b[1]:null;
  };

  const recalcCost=()=>{
    const price=Number(document.getElementById('pf-price').value)||0;
    const units=Number(document.getElementById('pf-units').value)||0;
    const qty=Number(document.getElementById('pf-content-qty').value)||0;
    const from=document.getElementById('pf-content-unit').value;
    const to=document.getElementById('pf-unit').value.trim();
    const f=unitFactor(from,to);
    let cost=0;
    if(price>0 && units>0 && qty>0 && f!==null) cost=price/(units*qty*f);
    document.getElementById('pf-cost').value=cost?cost.toFixed(6):'';
    const preview=document.getElementById('pf-cost-preview');
    if(preview){
      preview.textContent = cost>0
        ? `${units} unidad(es) × ${qty} ${from} = ${(units*qty*f).toFixed(3)} ${to} · Precio ${money(price)} · Costo ${unitCostMoney(cost)} por ${to}`
        : 'Completa precio, unidades y contenido para calcular automáticamente el costo por unidad de uso.';
    }
    return cost;
  };

  ['pf-price','pf-units','pf-content-qty','pf-content-unit','pf-unit'].forEach(id=>{
    const el=document.getElementById(id);
    if(el){ el.oninput=recalcCost; el.onchange=recalcCost; }
  });
  recalcCost();

  document.getElementById('pf-cancel').onclick=closeModal;
  document.getElementById('pf-save').onclick=()=>{
    const name=document.getElementById('pf-name').value.trim();
    if(!name){showToast('El nombre es obligatorio');return;}

    const unit=document.getElementById('pf-unit').value.trim();
    const stockMode=document.getElementById('pf-stock-mode').value;
    const physicalUnit=stockMode==='count'?'pieza':((stockMode==='level'||stockMode==='warehouse')?'':document.getElementById('pf-stock-unit').value.trim()||unit);

    const price=Number(document.getElementById('pf-price')?.value)||0;
    const unitsPer=Number(document.getElementById('pf-units')?.value)||0;
    const contentQty=Number(document.getElementById('pf-content-qty')?.value)||0;
    const contentUnit=document.getElementById('pf-content-unit')?.value||unit;
    const cost=recalcCost()||Number(product.cost)||0;

    const fields={
      name,
      brand:document.getElementById('pf-brand').value.trim(),
      categoryId:document.getElementById('pf-cat').value,
      supplierId:document.getElementById('pf-sup').value,
      unit,
      stockMode,
      stockUnit:physicalUnit,
      minStock:(stockMode==='level'||stockMode==='warehouse')?'':(document.getElementById('pf-min').value===''?'':Number(document.getElementById('pf-min').value)),
      purchaseUnit:document.getElementById('pf-punit').value.trim(),
      purchaseUnitQty:unitsPer*contentQty,
      purchasePrice:price,
      purchaseUnitsPerPresentation:unitsPer,
      purchasePiecesPerUnit:unitsPer,
      purchaseContentQty:contentQty,
      purchaseContentUnit:contentUnit,
      cost
    };

    if(stockMode==='warehouse'){
      const wh=document.getElementById('pf-warehouse-stock');
      const use=document.getElementById('pf-warehouse-level');
      if(!wh || !use || use.value===''){showToast('Indica bodega y recipiente en uso');return;}
      fields.warehouseStock=Math.max(0,Number(wh.value)||0);
      fields.stockLevel=Number(use.value);
      fields.stock=0;
      fields.stockDisplay=null;
    }else if(stockMode==='level'){
      const levelEl=isEdit?document.getElementById('pf-level'):document.getElementById('pf-initial-level');
      const levelValue=levelEl?levelEl.value:'';
      if(levelValue===''){showToast('Selecciona cuánto tienes actualmente');return;}
      fields.stockLevel=Number(levelValue);
      fields.stock=0;
      fields.stockDisplay=null;
    }else if(isEdit){
      // Edición de producto: no sobrescribir el stock actual desde este formulario.
      fields.stockLevel=product.stockLevel??'';
    }

    if(isEdit){
      Object.assign(product,fields);
    }else{
      const stock=stockMode==='warehouse'||stockMode==='level'?0:(Number(document.getElementById('pf-stock')?.value)||0);
      const stockLevel=stockMode==='warehouse' ? Number(fields.stockLevel||0) : (stockMode==='level'?Number(document.getElementById('pf-initial-level')?.value):'');
      const initialQty=stockMode==='warehouse' ? (Number(fields.warehouseStock)||0)+(Number(fields.stockLevel)||0)/100 : stock;
      state.products.push({...fields,id:uid('p'),stock,stockLevel,history:[{id:uid('h'),date:todayStr(),type:'costo',cost,qty:initialQty,note: stockMode==='warehouse'?'Alta inicial — Bodega + En uso':'Alta inicial'}]});
    }

    saveState(); closeModal(); render();
  };
}
