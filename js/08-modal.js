/* =====================================================================
   js/08-modal.js
   ---------------------------------------------------------------------
   Sistema de modal genérico (abrir/cerrar) usado por todos los formularios

   Nota: este archivo NO es un módulo ES — es un script clásico que
   comparte el mismo scope global que el resto de js/*.js (igual que ya
   funcionaba sync.js). Debe cargarse en el orden indicado en index.html;
   varios archivos usan funciones/variables definidas en archivos
   anteriores de esta misma lista.
   ===================================================================== */

/* ---------------- Modal genérico ---------------- */
function openModal(html){
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal">${html}</div>`;
  backdrop.addEventListener('click', (e)=>{ if(e.target===backdrop) closeModal(); });
  document.body.appendChild(backdrop);
}
function closeModal(){
  const b = document.getElementById('modal-backdrop');
  if(b) b.remove();
}

function openConfirmModal(message, onConfirm, confirmLabel){
  openModal(`
    <h3>Confirmar</h3>
    <p style="font-size:0.9rem; color:var(--chalk-dim); line-height:1.5; margin:0 0 4px;">${esc(message)}</p>
    <div class="modal-actions">
      <button class="btn ghost" id="cm-cancel">Cancelar</button>
      <button class="btn danger" id="cm-confirm">${esc(confirmLabel||'Confirmar')}</button>
    </div>
  `);
  document.getElementById('cm-cancel').onclick = closeModal;
  document.getElementById('cm-confirm').onclick = ()=>{ closeModal(); onConfirm(); };
}

function categoryOptions(selected){
  return `<option value="">Sin categoría</option>` + state.categories.map(c=>`<option value="${c.id}" ${selected===c.id?'selected':''}>${esc(c.name)}</option>`).join('');
}
function supplierOptions(selected){
  return `<option value="">Sin proveedor</option>` + state.suppliers.map(s=>`<option value="${s.id}" ${selected===s.id?'selected':''}>${esc(s.name)}</option>`).join('');
}

