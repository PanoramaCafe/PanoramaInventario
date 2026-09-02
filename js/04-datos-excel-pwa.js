/* =====================================================================
   js/04-datos-excel-pwa.js
   ---------------------------------------------------------------------
   Pestaña "Datos y app": exportar/importar Excel, respaldo JSON, integración Loyverse, instalación PWA

   Nota: este archivo NO es un módulo ES — es un script clásico que
   comparte el mismo scope global que el resto de js/*.js (igual que ya
   funcionaba sync.js). Debe cargarse en el orden indicado en index.html;
   varios archivos usan funciones/variables definidas en archivos
   anteriores de esta misma lista.
   ===================================================================== */

/* ---------------- Datos y app (Excel, respaldo, PWA, Loyverse) ---------------- */
function renderDatos(){
  return `
    <div class="card" id="install-card">
      <h2>Instalar la app</h2>
      <div class="card-sub">Úsala como una app, sin navegador, con ícono en tu pantalla de inicio — y sin conexión</div>
      <p style="font-size:0.9rem; color:var(--chalk-dim); line-height:1.5;">
        Los datos se guardan directamente en tu celular o computadora (no en un servidor), y la app queda cacheada para
        funcionar sin internet una vez que la abras al menos una vez conectado. Para que el botón "Instalar" aparezca,
        el archivo debe abrirse desde una dirección <strong>https</strong> (no directamente desde tu carpeta de descargas).
        La forma más rápida: sube la carpeta descargada a <strong>Netlify Drop</strong> (netlify.com/drop, arrastrar y soltar, sin
        cuenta) o a GitHub Pages, y abre el enlace que te den en tu celular.
      </p>
      <div id="install-status" class="pill-row"></div>
      <button class="btn" id="btn-install" style="display:none;">📲 Instalar app</button>
      <div class="pill-row">
        <span class="badge">iOS: Compartir → "Agregar a pantalla de inicio"</span>
        <span class="badge">Android/Chrome: menú ⋮ → "Instalar app" (o el botón de arriba)</span>
      </div>
    </div>

    <div class="card" style="border-left:4px solid var(--gold);">
      <h2>⚠ Datos y sincronización</h2>
      <div class="card-sub">Esta versión de prueba no debe sustituir tus datos automáticamente.</div>
      <p style="font-size:0.9rem; color:var(--chalk-dim); line-height:1.55;">
        Si abres la app directamente desde un ZIP o una carpeta temporal (<strong>file://</strong>), el navegador puede usar
        un almacenamiento local distinto al de la app publicada. Por eso pueden no aparecer tus productos aunque no se hayan borrado.
        Para recuperar los datos sincronizados, usa la app publicada y espera a que el estado de sincronización indique que se conectó.
      </p>
    </div>

    <div class="card">
      <h2>Excel</h2>
      <div class="card-sub">Exporta todo tu inventario o importa datos que ya tengas</div>
      <div class="pill-row">
        <button class="btn ghost" id="btn-export-excel">⬇ Exportar a Excel (.xlsx)</button>
        <label class="btn ghost" style="cursor:pointer; display:inline-flex; align-items:center;">
          ⬆ Importar desde Excel
          <input type="file" id="input-import-excel" accept=".xlsx,.xls,.csv" style="display:none;">
        </label>
      </div>
      <p style="font-size:0.82rem; color:var(--chalk-faint); line-height:1.5; margin-top:10px;">
        Al importar, la app busca columnas como <em>Nombre/Producto, Marca, Categoría, Proveedor, Unidad de uso, Costo/Precio,
        Stock/Cantidad, Stock mínimo, Unidad de compra, Piezas por unidad de compra</em> (no importa el orden ni mayúsculas).
        Si una categoría o proveedor no existe, se crea automáticamente y se vincula al producto. Si el producto ya existe
        (mismo nombre), se actualiza y su costo anterior queda guardado en el historial; si no existe, se crea nuevo.
      </p>
    </div>

    <div class="card">
      <h2>Respaldo completo</h2>
      <div class="card-sub">Copia de seguridad exacta de todo (incluye historial y pedidos guardados)</div>
      <div class="pill-row">
        <button class="btn ghost" id="btn-export-json">⬇ Descargar respaldo (.json)</button>
        <label class="btn ghost" style="cursor:pointer; display:inline-flex; align-items:center;">
          ⬆ Restaurar desde respaldo
          <input type="file" id="input-import-json" accept=".json" style="display:none;">
        </label>
      </div>
    </div>

    <div class="card">
      <h2>Integración con Loyverse</h2>
      <div class="card-sub">Cómo conectar tu inventario de Loyverse con esta app</div>
      <p style="font-size:0.87rem; color:var(--chalk-dim); line-height:1.6;">
        Loyverse tiene una API, pero requiere un token privado y llamadas desde un servidor — no es seguro ni técnicamente
        posible conectarla directamente desde esta app (que corre solo en tu navegador, sin backend propio).
      </p>
      <p style="font-size:0.87rem; color:var(--chalk-dim); line-height:1.6;">
        La forma práctica hoy: en el Back Office de Loyverse ve a <strong>Inventario → Exportar</strong> (o Reportes),
        descarga el Excel/CSV de tus artículos y súbelo aquí con el botón "Importar desde Excel" — la app vincula
        automáticamente por nombre de producto, categoría y proveedor.
      </p>
      <p style="font-size:0.87rem; color:var(--chalk-dim); line-height:1.6;">
        Si más adelante quieres una sincronización en vivo (dos vías, en tiempo real) sí se puede construir, pero
        necesita un pequeño servidor intermedio que guarde el token de forma segura y hable con la API de Loyverse.
        Puedo ayudarte a armarlo aparte si te interesa esa ruta.
      </p>
    </div>
  `;
}

function normalizeHeader(h){
  return String(h||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
}

function findCategoryByName(name){
  const n = name.trim().toLowerCase();
  return state.categories.find(c=>c.name.trim().toLowerCase()===n);
}
function findSupplierByName(name){
  const n = name.trim().toLowerCase();
  return state.suppliers.find(s=>s.name.trim().toLowerCase()===n);
}
function findProductByName(name){
  const n = name.trim().toLowerCase();
  return state.products.find(p=>p.name.trim().toLowerCase()===n);
}

function exportExcelWorkbook(){
  if(typeof XLSX === 'undefined'){ showToast('No se pudo cargar el módulo de Excel'); return; }
  const wb = XLSX.utils.book_new();

  const stockModeLabels = { count:'Por piezas / unidades', exact:'Por medida exacta', warehouse:'Bodega + En uso', level:'Recipiente / nivel aproximado' };

  const prodRows = state.products.map(p=>({
    'Nombre': p.name,
    'Marca': p.brand||'',
    'Categoría': catName(p.categoryId),
    'Proveedor': supName(p.supplierId),
    'Unidad de uso': p.unit||'',
    'Costo actual (por unidad de uso)': p.cost,
    'Stock (unidad de uso)': p.stock,
    'Stock mínimo': p.minStock===''||p.minStock==null ? '' : p.minStock,
    'Unidad de compra': p.purchaseUnit||'',
    'Piezas por unidad de compra': p.purchaseUnitQty===''||p.purchaseUnitQty==null ? '' : p.purchaseUnitQty,
    // --- Cómo se compra / precio pagado ---
    'Precio de compra (presentación)': p.purchasePrice===''||p.purchasePrice==null ? '' : p.purchasePrice,
    'Unidades por presentación': p.purchaseUnitsPerPresentation===''||p.purchaseUnitsPerPresentation==null ? '' : p.purchaseUnitsPerPresentation,
    'Contenido de cada unidad': p.purchaseContentQty===''||p.purchaseContentQty==null ? '' : p.purchaseContentQty,
    'Unidad del contenido': p.purchaseContentUnit||'',
    // --- Cómo se controla el stock ---
    'Tipo de control de stock': stockModeLabels[p.stockMode] || p.stockMode || '',
    'Stock actual (detalle)': stockControlLabel(p),
    'Bodega (unidades)': p.stockMode==='warehouse' ? (Number(p.warehouseStock)||0) : '',
    '% en uso / nivel': (p.stockMode==='warehouse'||p.stockMode==='level') ? (p.stockLevel??'') : ''
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(prodRows), 'Productos');

  const catRows = state.categories.map(c=>({'Categoría': c.name}));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(catRows), 'Categorías');

  const supRows = state.suppliers.map(s=>({'Proveedor': s.name, 'Contacto': s.contact||''}));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(supRows), 'Proveedores');

  const histRows = [];
  state.products.forEach(p=>{
    (p.history||[]).forEach(h=> histRows.push({
      'Producto': p.name, 'Fecha': h.date, 'Tipo': h.type,
      'Costo': h.cost!=null ? h.cost : '', 'Cantidad': h.qty||'', 'Nota': h.note||''
    }));
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(histRows), 'Historial');

  const orderRows = [];
  state.orders.forEach(o=>{
    o.items.forEach(it=> orderRows.push({
      'Fecha pedido': o.date, 'Proveedor': it.supplierName, 'Producto': it.name,
      'Cantidad': it.qty, 'Unidad': it.unit||'', 'Costo unitario': it.cost, 'Subtotal': it.subtotal
    }));
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(orderRows), 'Pedidos');

  XLSX.writeFile(wb, `inventario_panorama_cafe_${todayStr()}.xlsx`);
}

function importExcelFile(file){
  const reader = new FileReader();
  reader.onload = (e)=>{
    try{
      const wb = XLSX.read(e.target.result, {type:'array'});
      let sheetName = wb.SheetNames.find(n => normalizeHeader(n)==='productos') || wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, {defval:''});
      if(rows.length===0){ showToast('El archivo no tiene filas para importar'); return; }

      let created=0, updated=0, newCats=0, newSups=0;

      rows.forEach(row=>{
        const map = {};
        Object.keys(row).forEach(k => map[normalizeHeader(k)] = row[k]);
        const name = String(map['nombre'] ?? map['producto'] ?? '').trim();
        if(!name) return;
        const brand = String(map['marca'] ?? '').trim();
        const catRaw = String(map['categoria'] ?? '').trim();
        const supRaw = String(map['proveedor'] ?? '').trim();
        const unit = String(map['unidad de uso'] ?? map['unidad'] ?? '').trim();
        const costRaw = map['costo actual (por unidad de uso)'] ?? map['costo actual'] ?? map['costo'] ?? map['precio'] ?? '';
        const stockRaw = map['stock (unidad de uso)'] ?? map['stock'] ?? map['cantidad'] ?? '';
        const minRaw = map['stock minimo'] ?? map['minimo'] ?? map['stock min'] ?? '';
        const purchaseUnitRaw = String(map['unidad de compra'] ?? '').trim();
        const purchaseUnitQtyRaw = map['piezas por unidad de compra'] ?? map['contiene'] ?? '';
        const cost = costRaw==='' ? null : Number(costRaw);
        const stock = stockRaw==='' ? null : Number(stockRaw);
        const minStock = minRaw==='' ? '' : Number(minRaw);
        const purchaseUnitQty = purchaseUnitQtyRaw==='' ? '' : Number(purchaseUnitQtyRaw);

        let categoryId = '';
        if(catRaw){
          let c = findCategoryByName(catRaw);
          if(!c){ c = {id:uid('c'), name:catRaw}; state.categories.push(c); newCats++; }
          categoryId = c.id;
        }
        let supplierId = '';
        if(supRaw){
          let s = findSupplierByName(supRaw);
          if(!s){ s = {id:uid('s'), name:supRaw, contact:''}; state.suppliers.push(s); newSups++; }
          supplierId = s.id;
        }

        let p = findProductByName(name);
        if(p){
          p.categoryId = catRaw ? categoryId : p.categoryId;
          p.supplierId = supRaw ? supplierId : p.supplierId;
          p.unit = unit || p.unit;
          if(brand) p.brand = brand;
          if(purchaseUnitRaw) p.purchaseUnit = purchaseUnitRaw;
          if(purchaseUnitQtyRaw!=='') p.purchaseUnitQty = purchaseUnitQty;
          if(minRaw!=='') p.minStock = minStock;
          p.history = p.history || [];
          const costChanged = cost!=null && Number(cost)!==Number(p.cost);
          const stockChanged = stock!=null && Number(stock)!==Number(p.stock);
          if(costChanged || stockChanged){
            p.history.push({ id: uid('h'), date: todayStr(), type: costChanged?'costo':'ajuste',
              cost: costChanged ? cost : null, qty: stockChanged ? (stock - (Number(p.stock)||0)) : 0,
              note:'Importado desde Excel' });
          }
          if(cost!=null) p.cost = cost;
          if(stock!=null) p.stock = stock;
          updated++;
        } else {
          const finalCost = cost!=null ? cost : 0;
          const finalStock = stock!=null ? stock : 0;
          state.products.push({
            id: uid('p'), name, brand, categoryId, supplierId, unit,
            purchaseUnit: purchaseUnitRaw, purchaseUnitQty,
            cost: finalCost, stock: finalStock, minStock,
            history: [{ id: uid('h'), date: todayStr(), type:'costo', cost: finalCost, qty: finalStock, note:'Importado desde Excel' }]
          });
          created++;
        }
      });

      saveState(); render();
      ui.tab = 'datos'; render();
      showToast(`Importado: ${created} nuevos, ${updated} actualizados, ${newCats} categorías y ${newSups} proveedores creados`);
    }catch(err){
      console.error(err);
      showToast('No se pudo leer el archivo. Verifica el formato.');
    }
  };
  reader.readAsArrayBuffer(file);
}

function exportBackupJSON(){
  const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `respaldo_inventario_${todayStr()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function importBackupJSON(file){
  const proceed = ()=>{
    const reader = new FileReader();
    reader.onload = (e)=>{
      try{
        const data = JSON.parse(e.target.result);
        state = {
          categories: data.categories||[], suppliers: data.suppliers||[],
          products: data.products||[], orders: data.orders||[],
          counts: data.counts||[], recipes: data.recipes||[]
        };
        saveState(); render();
        showToast('Respaldo restaurado correctamente');
      }catch(err){
        showToast('El archivo no es un respaldo válido');
      }
    };
    reader.readAsText(file);
  };
  openConfirmModal('Esto reemplazará todos los datos actuales por los del respaldo. ¿Continuar?', proceed, 'Sí, reemplazar');
}

/* ---------------- PWA: instalación ---------------- */
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault();
  deferredInstallPrompt = e;
  const btn = document.getElementById('btn-install');
  if(btn) btn.style.display = 'inline-block';
});
window.addEventListener('appinstalled', ()=>{
  deferredInstallPrompt = null;
  showToast('App instalada');
});
if('serviceWorker' in navigator && location.protocol !== 'file:'){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  });
}

