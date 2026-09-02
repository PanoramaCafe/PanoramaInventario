/* =====================================================================
   js/11-form-cat-prov.js
   ---------------------------------------------------------------------
   Formularios de alta/edición de categoría y proveedor

   Nota: este archivo NO es un módulo ES — es un script clásico que
   comparte el mismo scope global que el resto de js/*.js (igual que ya
   funcionaba sync.js). Debe cargarse en el orden indicado en index.html;
   varios archivos usan funciones/variables definidas en archivos
   anteriores de esta misma lista.
   ===================================================================== */

/* ---------------- Formularios: categoría / proveedor ---------------- */
function openCategoryForm(cat){
  const isEdit = !!cat; cat = cat || {id:null, name:''};
  openModal(`
    <h3>${isEdit?'Editar categoría':'Nueva categoría'}</h3>
    <div class="field"><label>Nombre</label><input id="cf-name" value="${esc(cat.name)}" placeholder="Ej. Lácteos"></div>
    <div class="modal-actions">
      <button class="btn ghost" id="cf-cancel">Cancelar</button>
      <button class="btn" id="cf-save">${isEdit?'Guardar':'Crear'}</button>
    </div>
  `);
  document.getElementById('cf-cancel').onclick = closeModal;
  document.getElementById('cf-save').onclick = ()=>{
    const name = document.getElementById('cf-name').value.trim();
    if(!name){ showToast('El nombre es obligatorio'); return; }
    if(isEdit){ cat.name = name; } else { state.categories.push({id:uid('c'), name}); }
    saveState(); closeModal(); render();
  };
}

function openSupplierForm(sup){
  const isEdit = !!sup; sup = sup || {id:null, name:'', contact:''};
  openModal(`
    <h3>${isEdit?'Editar proveedor':'Nuevo proveedor'}</h3>
    <div class="field"><label>Nombre</label><input id="sf-name" value="${esc(sup.name)}" placeholder="Ej. Distribuidora El Grano"></div>
    <div class="field"><label>Contacto (tel./email)</label><input id="sf-contact" value="${esc(sup.contact||'')}" placeholder="Ej. 55 1234 5678 / pedidos@proveedor.com"></div>
    <div class="modal-actions">
      <button class="btn ghost" id="sf-cancel">Cancelar</button>
      <button class="btn" id="sf-save">${isEdit?'Guardar':'Crear'}</button>
    </div>
  `);
  document.getElementById('sf-cancel').onclick = closeModal;
  document.getElementById('sf-save').onclick = ()=>{
    const name = document.getElementById('sf-name').value.trim();
    if(!name){ showToast('El nombre es obligatorio'); return; }
    const contact = document.getElementById('sf-contact').value.trim();
    if(isEdit){ sup.name = name; sup.contact = contact; } else { state.suppliers.push({id:uid('s'), name, contact}); }
    saveState(); closeModal(); render();
  };
}

