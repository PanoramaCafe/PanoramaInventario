/* =====================================================================
   js/14-eventos.js
   ---------------------------------------------------------------------
   Wiring de eventos de toda la UI + arranque de la app (loadState()). Debe cargarse AL FINAL.

   Nota: este archivo NO es un módulo ES — es un script clásico que
   comparte el mismo scope global que el resto de js/*.js (igual que ya
   funcionaba sync.js). Debe cargarse en el orden indicado en index.html;
   varios archivos usan funciones/variables definidas en archivos
   anteriores de esta misma lista.
   ===================================================================== */

/* ---------------- Eventos ---------------- */
function esc(s){ return String(s??'').replace(/[&<>\"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c])); }

// Re-render de la pantalla de conteo sin perder la posición del usuario.
// En algunos navegadores Android, reemplazar app.innerHTML mientras un
// control tiene el foco provoca que el scroll vuelva al inicio de la página.
function renderConteoPreservePosition(activeSelector){
  const x = window.scrollX || 0;
  const y = window.scrollY || 0;
  render();

  if(activeSelector){
    const again = document.querySelector(activeSelector);
    if(again){
      try{ again.focus({preventScroll:true}); }
      catch(_){ again.focus(); }
    }
  }

  // Dos frames ayudan especialmente en Chrome/Samsung cuando el teclado
  // virtual reajusta el viewport después de reconstruir el DOM.
  requestAnimationFrame(()=>{
    window.scrollTo(x,y);
    requestAnimationFrame(()=>window.scrollTo(x,y));
  });
}

function attachGlobalEvents(){
  document.querySelectorAll('nav.tabs button').forEach(b=>{
    b.onclick = ()=>{ ui.tab = b.dataset.tab; render(); };
  });

  // Productos
  const btnNewProduct = document.getElementById('btn-new-product');
  if(btnNewProduct) btnNewProduct.onclick = ()=> openProductForm(null);

  const fSearch = document.getElementById('f-search');
  if(fSearch) fSearch.oninput = (e)=>{ ui.search = e.target.value; render(); document.getElementById('f-search').focus(); document.getElementById('f-search').setSelectionRange(9999,9999); };
  const fCat = document.getElementById('f-cat');
  if(fCat) fCat.onchange = (e)=>{ ui.filterCat = e.target.value; render(); };
  const fSup = document.getElementById('f-sup');
  if(fSup) fSup.onchange = (e)=>{ ui.filterSup = e.target.value; render(); };
  const fBrand = document.getElementById('f-brand');
  if(fBrand) fBrand.onchange = (e)=>{ ui.filterBrand = e.target.value; render(); };

  document.querySelectorAll('[data-action="restock"]').forEach(b=> b.onclick = ()=>{
    const p = state.products.find(pp=>pp.id===b.dataset.id); if(p) openRestockForm(p);
  });
  document.querySelectorAll('[data-action="adjust"]').forEach(b=> b.onclick = ()=>{
    const p = state.products.find(pp=>pp.id===b.dataset.id); if(p) openAdjustStockForm(p);
  });
  document.querySelectorAll('[data-action="history"]').forEach(b=> b.onclick = ()=>{
    ui.expandedHistory = (ui.expandedHistory===b.dataset.id) ? null : b.dataset.id; render();
  });
  document.querySelectorAll('[data-action="edit-product"]').forEach(b=> b.onclick = ()=>{
    const p = state.products.find(pp=>pp.id===b.dataset.id); if(p) openProductForm(p);
  });
  document.querySelectorAll('[data-action="delete-product"]').forEach(b=> b.onclick = ()=>{
    openConfirmModal('¿Eliminar este producto y su historial?', ()=>{
      state.products = state.products.filter(p=>p.id!==b.dataset.id);
      saveState(); render();
    }, 'Sí, eliminar');
  });

  // Categorías
  const btnNewCat = document.getElementById('btn-new-cat');
  if(btnNewCat) btnNewCat.onclick = ()=> openCategoryForm(null);
  document.querySelectorAll('[data-action="edit-cat"]').forEach(b=> b.onclick = ()=>{
    const c = state.categories.find(cc=>cc.id===b.dataset.id); if(c) openCategoryForm(c);
  });
  document.querySelectorAll('[data-action="delete-cat"]').forEach(b=> b.onclick = ()=>{
    const inUse = productsByCategory(b.dataset.id).length;
    const doDelete = ()=>{
      state.products.forEach(p=>{ if(p.categoryId===b.dataset.id) p.categoryId=''; });
      state.categories = state.categories.filter(c=>c.id!==b.dataset.id);
      saveState(); render();
    };
    if(inUse>0){
      openConfirmModal(`${inUse} producto(s) usan esta categoría y quedarán como "Sin categoría". ¿Continuar?`, doDelete, 'Sí, eliminar');
    } else {
      doDelete();
    }
  });

  // Proveedores
  const btnNewSup = document.getElementById('btn-new-sup');
  if(btnNewSup) btnNewSup.onclick = ()=> openSupplierForm(null);
  document.querySelectorAll('[data-action="edit-sup"]').forEach(b=> b.onclick = ()=>{
    const s = state.suppliers.find(ss=>ss.id===b.dataset.id); if(s) openSupplierForm(s);
  });
  document.querySelectorAll('[data-action="delete-sup"]').forEach(b=> b.onclick = ()=>{
    const inUse = productsBySupplier(b.dataset.id).length;
    const doDelete = ()=>{
      state.products.forEach(p=>{ if(p.supplierId===b.dataset.id) p.supplierId=''; });
      state.suppliers = state.suppliers.filter(s=>s.id!==b.dataset.id);
      saveState(); render();
    };
    if(inUse>0){
      openConfirmModal(`${inUse} producto(s) usan esta categoría y quedarán como "Sin proveedor". ¿Continuar?`, doDelete, 'Sí, eliminar');
    } else {
      doDelete();
    }
  });

  // Conteo físico
  const cntFilterCat = document.getElementById('cnt-filter-cat');
  if(cntFilterCat) cntFilterCat.onchange = (e)=>{ ui.countFilterCat = e.target.value; render(); };

  // En Android/Samsung no reconstruimos toda la pantalla en cada tecla.
  // El valor queda en ui.countDraft mientras se captura y el render se hace
  // al cambiar de control, conservando la posición y el foco.
  document.querySelectorAll('[data-count-qty]').forEach(e=>{
    e.oninput = ()=>{
      ui.countDraft[e.dataset.countQty] = e.value;
    };
    e.onchange = ()=>{
      ui.countDraft[e.dataset.countQty] = e.value;
      renderConteoPreservePosition(`[data-count-qty="${e.dataset.countQty}"]`);
    };
  });

  document.querySelectorAll('[data-count-warehouse]').forEach(e=>{
    e.oninput=()=>{
      const id=e.dataset.countWarehouse;
      const d=ui.countDraft[id]&&typeof ui.countDraft[id]==='object'?ui.countDraft[id]:{};
      d.warehouse=e.value;
      ui.countDraft[id]=d;
    };
    e.onchange=()=>{
      const id=e.dataset.countWarehouse;
      const d=ui.countDraft[id]&&typeof ui.countDraft[id]==='object'?ui.countDraft[id]:{};
      d.warehouse=e.value;
      ui.countDraft[id]=d;
      renderConteoPreservePosition(`[data-count-warehouse="${id}"]`);
    };
  });

  document.querySelectorAll('[data-count-warehouse-level]').forEach(e=>{
    e.onchange=()=>{
      const id=e.dataset.countWarehouseLevel;
      const d=ui.countDraft[id]&&typeof ui.countDraft[id]==='object'?ui.countDraft[id]:{};
      d.level=e.value;
      ui.countDraft[id]=d;
      renderConteoPreservePosition(`[data-count-warehouse-level="${id}"]`);
    };
  });

  document.querySelectorAll('[data-count-level]').forEach(e=>{
    e.onchange = ()=>{
      ui.countDraft[e.dataset.countLevel] = e.value;
      renderConteoPreservePosition(`[data-count-level="${e.dataset.countLevel}"]`);
    };
  });

  const btnCancelCount = document.getElementById('btn-cancel-count');
  if(btnCancelCount) btnCancelCount.onclick = ()=>{
    ui.countDraft = {};
    ui.countNote = '';
    render();
  };

  const btnApplyCount = document.getElementById('btn-apply-count');
  if(btnApplyCount) btnApplyCount.onclick = ()=>{
    const date=todayStr();
    const items=[];
    let value=0;

    Object.keys(ui.countDraft).forEach(id=>{
      const raw=ui.countDraft[id];
      if(raw===''||raw==null) return;
      const p=state.products.find(pp=>pp.id===id);
      if(!p) return;

      if(p.stockMode==='warehouse'){ const d=raw&&typeof raw==='object'?raw:{}; const bw=Number(d.warehouse), bl=Number(d.level); if(!Number.isFinite(bw)||!Number.isFinite(bl)) return; const prevB=Number(p.warehouseStock)||0, prevL=Number(p.stockLevel)||0; const previous=prevB+prevL/100, counted=bw+bl/100, variance=counted-previous; if(variance===0) return; p.history=p.history||[]; p.history.push({id:uid('h'),date,type:'conteo',cost:null,qty:variance,note:`Conteo físico — Bodega ${bw}, En uso ${bl}%`+(ui.countNote?' — '+ui.countNote:'')}); p.warehouseStock=bw; p.stockLevel=bl; const impact=variance*stockCostPerPhysicalUnit(p); value+=impact; items.push({productId:p.id,name:p.name,systemQty:previous,countedQty:counted,variance,mode:'warehouse',warehouse:bw,level:bl});
      } else if(p.stockMode==='level'){
        const countedLevel=Number(raw);
        const previousLevel=Number(p.stockLevel)||0;
        const variance=countedLevel-previousLevel;
        if(variance===0) return;

        p.history=p.history||[];
        p.history.push({
          id:uid('h'),
          date,
          type:'conteo',
          cost:null,
          qty:0,
          note:'Conteo físico — nivel '+countedLevel+'%' + (ui.countNote?' — '+ui.countNote:'')
        });
        p.stockLevel=countedLevel;

        const impact=(variance/100)*stockCostPerPhysicalUnit(p);
        value += impact;
        items.push({
          productId:p.id,name:p.name,
          systemQty:previousLevel,countedQty:countedLevel,
          variance,mode:'level'
        });
      }else{
        const counted=Number(raw);
        const previous=Number(p.stock)||0;
        const variance=counted-previous;
        if(variance===0) return;

        p.history=p.history||[];
        p.history.push({
          id:uid('h'),
          date,
          type:'conteo',
          cost:null,
          qty:variance,
          note:'Conteo físico' + (ui.countNote?' — '+ui.countNote:'')
        });
        p.stock=counted;

        const impact=variance*stockCostPerPhysicalUnit(p);
        value += impact;
        items.push({
          productId:p.id,name:p.name,
          systemQty:previous,countedQty:counted,
          variance,mode:p.stockMode
        });
      }
    });

    if(items.length===0){showToast('No hay diferencias que aplicar');return;}
    state.counts.push({id:uid('cnt'),date,note:ui.countNote,items,value});
    ui.countDraft={};
    ui.countNote='';
    saveState();
    render();
    showToast('Conteo aplicado y guardado');
  };

  // Lista de compra
  document.querySelectorAll('[data-purchase-qty]').forEach(inp=>{
    inp.oninput = (e)=>{
      ui.purchase[inp.dataset.purchaseQty] = e.target.value;
      render();
      const again = document.querySelector(`[data-purchase-qty="${inp.dataset.purchaseQty}"]`);
      if(again){ again.focus(); }
    };
  });
  const btnExportAll = document.getElementById('btn-export-all');
  if(btnExportAll) btnExportAll.onclick = exportAllCSV;
  const btnExportAllPdf = document.getElementById('btn-export-all-pdf');
  if(btnExportAllPdf) btnExportAllPdf.onclick = exportAllPDF;
  const btnSaveOrder = document.getElementById('btn-save-order');
  if(btnSaveOrder) btnSaveOrder.onclick = ()=>{
    const items = currentPurchaseItems();
    if(items.length===0) return;
    const total = items.reduce((s,it)=>s+it.subtotal,0);
    state.orders.push({ id: uid('o'), date: todayStr(), items, total });
    saveState();
    ui.purchase = {};
    showToast('Pedido guardado');
    render();
  };
  document.querySelectorAll('[data-action="download-order-pdf"]').forEach(b=> b.onclick = ()=> exportSavedOrderPDF(b.dataset.id));
  document.querySelectorAll('[data-action="export-supplier"]').forEach(b=> b.onclick = ()=> exportSupplierCSV(b.dataset.sup));
  document.querySelectorAll('[data-action="export-supplier-pdf"]').forEach(b=> b.onclick = ()=> exportSupplierPDF(b.dataset.sup));
  document.querySelectorAll('[data-action="copy-supplier"]').forEach(b=> b.onclick = ()=> copySupplierText(b.dataset.sup));
  document.querySelectorAll('[data-action="delete-order"]').forEach(b=> b.onclick = ()=>{
    openConfirmModal('¿Eliminar este pedido del historial?', ()=>{
      state.orders = state.orders.filter(o=>o.id!==b.dataset.id);
      saveState(); render();
    }, 'Sí, eliminar');
  });

  // Loza
  const btnNewLoza = document.getElementById('btn-new-loza');
  if(btnNewLoza) btnNewLoza.onclick = ()=> openLozaForm(null);

  const fLozaSearch = document.getElementById('f-loza-search');
  if(fLozaSearch) fLozaSearch.oninput = (e)=>{
    ui.lozaSearch = e.target.value; render();
    const again = document.getElementById('f-loza-search');
    if(again){ again.focus(); again.setSelectionRange(9999,9999); }
  };

  document.querySelectorAll('[data-action="loza-adjust"]').forEach(b=> b.onclick = ()=>{
    const i = state.loza.find(ii=>ii.id===b.dataset.id); if(i) openLozaAdjustForm(i);
  });
  document.querySelectorAll('[data-action="loza-history"]').forEach(b=> b.onclick = ()=>{
    ui.lozaExpandedHistory = (ui.lozaExpandedHistory===b.dataset.id) ? null : b.dataset.id; render();
  });
  document.querySelectorAll('[data-action="loza-edit"]').forEach(b=> b.onclick = ()=>{
    const i = state.loza.find(ii=>ii.id===b.dataset.id); if(i) openLozaForm(i);
  });
  document.querySelectorAll('[data-action="loza-delete"]').forEach(b=> b.onclick = ()=>{
    openConfirmModal('¿Eliminar este artículo de loza y su historial?', ()=>{
      state.loza = state.loza.filter(i=>i.id!==b.dataset.id);
      saveState(); render();
    }, 'Sí, eliminar');
  });

  const btnExportLozaExcel = document.getElementById('btn-export-loza-excel');
  if(btnExportLozaExcel) btnExportLozaExcel.onclick = exportLozaExcel;
  const btnExportLozaPdf = document.getElementById('btn-export-loza-pdf');
  if(btnExportLozaPdf) btnExportLozaPdf.onclick = exportLozaPDF;

  // Datos y app
  const btnInstall = document.getElementById('btn-install');
  if(btnInstall){
    if(deferredInstallPrompt) btnInstall.style.display = 'inline-block';
    btnInstall.onclick = async ()=>{
      if(!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      btnInstall.style.display = 'none';
    };
  }
  const btnExportExcel = document.getElementById('btn-export-excel');
  if(btnExportExcel) btnExportExcel.onclick = exportExcelWorkbook;
  const inputImportExcel = document.getElementById('input-import-excel');
  if(inputImportExcel) inputImportExcel.onchange = (e)=>{
    if(e.target.files[0]) importExcelFile(e.target.files[0]);
    e.target.value = '';
  };
  const btnExportJson = document.getElementById('btn-export-json');
  if(btnExportJson) btnExportJson.onclick = exportBackupJSON;
  const inputImportJson = document.getElementById('input-import-json');
  if(inputImportJson) inputImportJson.onchange = (e)=>{
    if(e.target.files[0]) importBackupJSON(e.target.files[0]);
    e.target.value = '';
  };
}

loadState();
