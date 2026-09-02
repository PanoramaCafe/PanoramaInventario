/* =====================================================================
   js/06-recetas.js
   ---------------------------------------------------------------------
   Recetas y registro de producción (descuento de insumos)

   Nota: este archivo NO es un módulo ES — es un script clásico que
   comparte el mismo scope global que el resto de js/*.js (igual que ya
   funcionaba sync.js). Debe cargarse en el orden indicado en index.html;
   varios archivos usan funciones/variables definidas en archivos
   anteriores de esta misma lista.
   ===================================================================== */

/* ---------------- Recetas / Producción ---------------- */
function recipeIngredientCost(recipe){
  return (recipe.ingredients||[]).reduce((sum,ing)=>{
    const p = state.products.find(pp=>pp.id===ing.productId);
    return sum + (p ? (Number(p.cost)||0)*(Number(ing.qty)||0) : 0);
  },0);
}

function renderRecetas(){
  return `
    <div class="card">
      <div class="toolbar">
        <h2 style="margin:0;">Recetas</h2>
        <button class="btn" id="btn-new-recipe">+ Nueva receta</button>
      </div>
      <div class="card-sub">Define qué ingredientes consume cada bebida o platillo. Al registrar una producción, se descuenta el stock de cada ingrediente automáticamente.</div>
      ${state.recipes.length===0 ? `
        <div class="empty"><div class="em-title">Sin recetas todavía</div><div>Ej. "Latte 12oz" = café en grano + leche + vaso.</div></div>
      ` : `
      <table>
        <thead><tr><th>Receta</th><th>Ingredientes</th><th>Vinculada a</th><th class="num">Costo por lote</th><th></th></tr></thead>
        <tbody>
        ${state.recipes.map(r=>{
          const ingList = (r.ingredients||[]).map(ing=>{
            const p = state.products.find(pp=>pp.id===ing.productId);
            return p ? `${p.name} (${ing.qty} ${p.unit||''})` : null;
          }).filter(Boolean).join(', ');
          const output = r.outputProductId ? state.products.find(p=>p.id===r.outputProductId) : null;
          return `<tr>
            <td>${esc(r.name)}</td>
            <td style="font-size:0.82rem; color:var(--chalk-dim);">${esc(ingList)||'—'}</td>
            <td>${output ? esc(output.name) : '<span style="color:var(--chalk-faint);">solo consumo</span>'}</td>
            <td class="num">${money(recipeIngredientCost(r))}</td>
            <td class="row-actions">
              <button class="btn small" data-action="produce" data-id="${r.id}">Producir</button>
              <button class="icon-btn" data-action="edit-recipe" data-id="${r.id}">✎ Editar</button>
              <button class="icon-btn danger" data-action="delete-recipe" data-id="${r.id}">✕ Eliminar</button>
            </td>
          </tr>`;
        }).join('')}
        </tbody>
      </table>
      `}
    </div>
  `;
}

function productOptionsList(selected){
  return `<option value="">Selecciona un producto...</option>` + state.products.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(p=>`<option value="${p.id}" ${selected===p.id?'selected':''}>${esc(p.name)} (${esc(p.unit||'u')})</option>`).join('');
}

let recipeDraftIngredients = [];

function renderIngredientRows(){
  const container = document.getElementById('rf-ingredients');
  if(!container) return;
  if(recipeDraftIngredients.length===0) recipeDraftIngredients.push({productId:'', qty:''});
  container.innerHTML = recipeDraftIngredients.map((ing, idx)=>`
    <div class="field-row" style="grid-template-columns:2fr 1fr auto; align-items:end; margin-bottom:8px;">
      <div class="field" style="margin-bottom:0;">
        ${idx===0?'<label>Ingrediente</label>':''}
        <select class="rf-ing-prod" data-idx="${idx}">${productOptionsList(ing.productId)}</select>
      </div>
      <div class="field" style="margin-bottom:0;">
        ${idx===0?'<label>Cantidad por lote</label>':''}
        <input class="rf-ing-qty" data-idx="${idx}" type="number" min="0" step="any" value="${ing.qty}">
      </div>
      <button class="icon-btn rf-remove-ing" data-idx="${idx}" title="Quitar" style="margin-bottom:2px;">✕</button>
    </div>
  `).join('');
  container.querySelectorAll('.rf-ing-prod').forEach(el=> el.onchange = (e)=>{ recipeDraftIngredients[el.dataset.idx].productId = e.target.value; });
  container.querySelectorAll('.rf-ing-qty').forEach(el=> el.oninput = (e)=>{ recipeDraftIngredients[el.dataset.idx].qty = e.target.value; });
  container.querySelectorAll('.rf-remove-ing').forEach(el=> el.onclick = ()=>{
    recipeDraftIngredients.splice(Number(el.dataset.idx),1);
    renderIngredientRows();
  });
}

function openRecipeForm(recipe){
  const isEdit = !!recipe;
  recipe = recipe || {id:null, name:'', note:'', outputProductId:'', yieldQty:1, ingredients:[]};
  recipeDraftIngredients = (recipe.ingredients||[]).map(i=>({...i}));

  openModal(`
    <h3>${isEdit?'Editar receta':'Nueva receta'}</h3>
    <div class="field"><label>Nombre</label><input id="rf-name" value="${esc(recipe.name)}" placeholder="Ej. Latte 12oz"></div>
    <div class="field-row">
      <div class="field"><label>Producto vinculado (opcional)</label><select id="rf-output"><option value="">Solo registrar consumo</option>${state.products.map(p=>`<option value="${p.id}" ${recipe.outputProductId===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Rinde (unidades por lote)</label><input id="rf-yield" type="number" min="1" step="any" value="${recipe.yieldQty||1}"></div>
    </div>
    <label>Ingredientes</label>
    <div id="rf-ingredients" style="margin-top:4px;"></div>
    <button class="btn ghost small" id="rf-add-ing" type="button">+ Agregar ingrediente</button>
    <div class="field" style="margin-top:14px;"><label>Nota (opcional)</label><input id="rf-note" value="${esc(recipe.note||'')}" placeholder="Ej. receta estándar de barra"></div>
    <div class="modal-actions">
      <button class="btn ghost" id="rf-cancel">Cancelar</button>
      <button class="btn" id="rf-save">${isEdit?'Guardar cambios':'Crear receta'}</button>
    </div>
  `);
  renderIngredientRows();
  document.getElementById('rf-add-ing').onclick = ()=>{ recipeDraftIngredients.push({productId:'', qty:''}); renderIngredientRows(); };
  document.getElementById('rf-cancel').onclick = closeModal;
  document.getElementById('rf-save').onclick = ()=>{
    const name = document.getElementById('rf-name').value.trim();
    if(!name){ showToast('El nombre es obligatorio'); return; }
    const outputProductId = document.getElementById('rf-output').value;
    const yieldQty = Number(document.getElementById('rf-yield').value)||1;
    const note = document.getElementById('rf-note').value.trim();
    const ingredients = recipeDraftIngredients
      .filter(i=> i.productId && Number(i.qty)>0)
      .map(i=> ({productId: i.productId, qty: Number(i.qty)}));
    if(ingredients.length===0){ showToast('Agrega al menos un ingrediente con cantidad'); return; }
    if(isEdit){
      recipe.name=name; recipe.outputProductId=outputProductId; recipe.yieldQty=yieldQty; recipe.note=note; recipe.ingredients=ingredients;
    } else {
      state.recipes.push({id:uid('r'), name, outputProductId, yieldQty, note, ingredients});
    }
    saveState(); closeModal(); render();
  };
}

function openProduceForm(recipe){
  const cost = recipeIngredientCost(recipe);
  openModal(`
    <h3>Producir — ${esc(recipe.name)}</h3>
    <div class="card-sub">Costo de ingredientes por lote: ${money(cost)}</div>
    <div class="field-row">
      <div class="field"><label>Lotes a producir</label><input id="pf-batches" type="number" min="1" step="any" value="1"></div>
      <div class="field"><label>Fecha</label><input id="pf-date" type="date" value="${todayStr()}"></div>
    </div>
    <div class="field"><label>Nota (opcional)</label><input id="pf-note" placeholder="Ej. producción del turno matutino"></div>
    <div id="pf-preview" style="font-size:0.85rem; color:var(--chalk-dim); margin-top:6px;"></div>
    <div class="modal-actions">
      <button class="btn ghost" id="pf-cancel">Cancelar</button>
      <button class="btn" id="pf-confirm">Registrar producción</button>
    </div>
  `);
  const updatePreview = ()=>{
    const batches = Number(document.getElementById('pf-batches').value)||0;
    const lines = (recipe.ingredients||[]).map(ing=>{
      const p = state.products.find(pp=>pp.id===ing.productId);
      if(!p) return '';
      const need = ing.qty*batches;
      const physicalNeed = usageToPhysicalStock(p, need);
      const available = Number(p.stock)||0;
      const short = p.stockMode!=='level' && physicalNeed > available;
      const displayNeed = p.stockMode==='count' ? `${physicalNeed.toFixed(3).replace(/\.?0+$/,'')} ${stockControlUnit(p)}` : `${need} ${esc(p.unit||'')}`;
      return `<div>${esc(p.name)}: consumo de receta ${need} ${esc(p.unit||'')} → descuenta ${displayNeed} del stock físico ${short? '<span style="color:var(--rose);">(insuficiente, hay '+stockControlLabel(p)+')</span>':''}</div>`;
    }).join('');
    document.getElementById('pf-preview').innerHTML = lines;
  };
  document.getElementById('pf-batches').oninput = updatePreview;
  updatePreview();
  document.getElementById('pf-cancel').onclick = closeModal;
  document.getElementById('pf-confirm').onclick = ()=>{
    const batches = Number(document.getElementById('pf-batches').value)||0;
    const date = document.getElementById('pf-date').value || todayStr();
    const note = document.getElementById('pf-note').value.trim();
    if(batches<=0){ showToast('Ingresa una cantidad de lotes válida'); return; }
    (recipe.ingredients||[]).forEach(ing=>{
      const p = state.products.find(pp=>pp.id===ing.productId);
      if(!p) return;
      const consumed = ing.qty*batches;
      const physicalConsumed = usageToPhysicalStock(p, consumed);
      p.history = p.history || [];
      p.history.push({ id: uid('h'), date, type:'produccion', cost:null, qty: -physicalConsumed, note: `Producción: ${recipe.name}; consumo ${consumed} ${p.unit||''}` + (note? ' — '+note:'') });
      if(p.stockMode!=='level') p.stock = (Number(p.stock)||0) - physicalConsumed;
    });
    if(recipe.outputProductId){
      const out = state.products.find(p=>p.id===recipe.outputProductId);
      if(out){
        const produced = (recipe.yieldQty||1)*batches;
        out.history = out.history || [];
        out.history.push({ id: uid('h'), date, type:'produccion', cost:null, qty: produced, note: `Producción: ${recipe.name}` + (note? ' — '+note:'') });
        out.stock = (Number(out.stock)||0) + produced;
      }
    }
    saveState(); closeModal(); render();
    showToast('Producción registrada');
  };
}

