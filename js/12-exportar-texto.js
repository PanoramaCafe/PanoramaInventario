/* =====================================================================
   js/12-exportar-texto.js
   ---------------------------------------------------------------------
   Exportar listas en texto/CSV (para compartir por WhatsApp, copiar, etc.)

   Nota: este archivo NO es un módulo ES — es un script clásico que
   comparte el mismo scope global que el resto de js/*.js (igual que ya
   funcionaba sync.js). Debe cargarse en el orden indicado en index.html;
   varios archivos usan funciones/variables definidas en archivos
   anteriores de esta misma lista.
   ===================================================================== */

/* ---------------- Exportar CSV / texto ---------------- */
function downloadCSV(filename, rows){
  const csv = rows.map(r => r.map(cell => {
    const s = String(cell ?? '');
    return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s;
  }).join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function currentPurchaseItems(){
  return Object.keys(ui.purchase).filter(id=>Number(ui.purchase[id])>0).map(id=>{
    const p = state.products.find(pp=>pp.id===id);
    if(!p) return null;
    const unitCost = orderUnitCost(p);
    const qty = Number(ui.purchase[id]);
    return { productId:id, name: p.name + (p.brand? ` (${p.brand})` : ''), supplierName: supName(p.supplierId), unit: orderUnit(p), qty, cost: unitCost, subtotal: qty*unitCost };
  }).filter(Boolean);
}

function exportAllCSV(){
  const items = currentPurchaseItems();
  if(items.length===0){ showToast('Agrega cantidades primero'); return; }
  const rows = [['Proveedor','Producto','Cantidad','Unidad','Costo unitario','Subtotal']];
  items.forEach(it => rows.push([it.supplierName, it.name, it.qty, it.unit, it.cost, it.subtotal.toFixed(2)]));
  const total = items.reduce((s,it)=>s+it.subtotal,0);
  rows.push(['','','','','Total', total.toFixed(2)]);
  downloadCSV(`lista_compra_${todayStr()}.csv`, rows);
}

function exportSupplierCSV(supId){
  const items = currentPurchaseItems().filter(it=>{
    const p = state.products.find(pp=>pp.id===it.productId);
    return (p.supplierId||'none') === supId;
  });
  if(items.length===0) return;
  const supNameStr = supId==='none' ? 'sin_proveedor' : supName(supId);
  const rows = [['Producto','Cantidad','Unidad','Costo unitario','Subtotal']];
  items.forEach(it => rows.push([it.name, it.qty, it.unit, it.cost, it.subtotal.toFixed(2)]));
  const total = items.reduce((s,it)=>s+it.subtotal,0);
  rows.push(['','','','Total', total.toFixed(2)]);
  downloadCSV(`pedido_${supNameStr.replace(/\s+/g,'_')}_${todayStr()}.csv`, rows);
}

function copySupplierText(supId){
  const items = currentPurchaseItems().filter(it=>{
    const p = state.products.find(pp=>pp.id===it.productId);
    return (p.supplierId||'none') === supId;
  });
  if(items.length===0) return;
  const supNameStr = supId==='none' ? 'Sin proveedor' : supName(supId);
  let text = `Pedido para ${supNameStr} — ${todayStr()}\n\n`;
  items.forEach(it => text += `• ${it.name}: ${it.qty} ${it.unit||''}\n`);
  const total = items.reduce((s,it)=>s+it.subtotal,0);
  text += `\nTotal estimado: ${money(total)}`;
  navigator.clipboard.writeText(text).then(()=>{
    showToast('Texto copiado — listo para pegar y enviar');
  }).catch(()=>{
    showToast('No se pudo copiar automáticamente');
  });
}

function pdfHeader(doc, title, date){
  doc.setFont('helvetica','bold'); doc.setFontSize(14);
  doc.text('Panorama Café', 14, 16);
  doc.setFont('helvetica','normal'); doc.setFontSize(10);
  doc.text(title, 14, 23);
  doc.setFontSize(9); doc.setTextColor(120);
  doc.text(`Fecha: ${date || todayStr()}`, 14, 29);
  doc.setTextColor(20);
}

function addProviderPDFSection(doc, providerName, items, startY){
  let y=startY;
  // Keep all suppliers in one continuous PDF flow. jsPDF/autoTable adds pages
  // only when the current page is actually full.
  if(y>250){
    doc.addPage();
    pdfHeader(doc,'Lista de compra completa',todayStr());
    y=34;
  }
  doc.setFont('helvetica','bold');
  doc.setFontSize(11);
  doc.text(providerName,14,y);
  y += 5;

  const body=items.map(it=>[
    it.name || 'Producto',
    `${it.qty} ${it.unit||''}`,
    money(it.cost),
    money(it.subtotal)
  ]);

  doc.autoTable({
    startY:y,
    head:[['Producto','Cantidad','Costo unit.','Subtotal']],
    body,
    styles:{fontSize:9,cellPadding:3},
    headStyles:{fillColor:[169,118,15]},
    margin:{left:14,right:14}
  });

  return doc.lastAutoTable.finalY + 9;
}

function exportSavedOrderPDF(orderId){
  if(typeof window.jspdf === 'undefined'){ showToast('No se pudo cargar el módulo de PDF'); return; }
  const order=state.orders.find(o=>o.id===orderId);
  if(!order || !(order.items||[]).length){ showToast('No se encontró el detalle de este pedido'); return; }

  const {jsPDF}=window.jspdf;
  const doc=new jsPDF();
  const orderDate=order.date||todayStr();
  pdfHeader(doc,'Lista de compra completa',orderDate);

  const groups={};
  (order.items||[]).forEach(it=>{
    const p=state.products.find(pp=>pp.id===it.productId);
    const key=(p?.supplierId||it.supplierId||'none');
    groups[key]=groups[key]||[];
    groups[key].push(it);
  });

  let y=34;
  Object.keys(groups).forEach(supId=>{
    const name=supId==='none'?'Sin proveedor asignado':supName(supId);
    y=addProviderPDFSection(doc,name,groups[supId],y);
  });

  const total=Number(order.total)||(order.items||[]).reduce((s,it)=>s+(Number(it.subtotal)||0),0);
  if(y>270){doc.addPage();pdfHeader(doc,'Lista de compra completa',orderDate);y=34;}
  doc.setFont('helvetica','bold');doc.setFontSize(11);
  doc.text(`Presupuesto total: ${money(total)}`,14,y);
  doc.save(`lista_compra_${orderDate}.pdf`);
}

function exportAllPDF(){
  if(typeof window.jspdf === 'undefined'){ showToast('No se pudo cargar el módulo de PDF'); return; }
  const items=currentPurchaseItems();
  if(items.length===0){ showToast('Agrega cantidades primero'); return; }

  const {jsPDF}=window.jspdf;
  const doc=new jsPDF();
  const orderDate=todayStr();
  pdfHeader(doc,'Lista de compra completa',orderDate);

  const groups={};
  items.forEach(it=>{
    const p=state.products.find(pp=>pp.id===it.productId);
    const supId=p?.supplierId||'none';
    groups[supId]=groups[supId]||[];
    groups[supId].push(it);
  });

  let y=34;
  Object.keys(groups).forEach(supId=>{
    const name=supId==='none'?'Sin proveedor asignado':supName(supId);
    y=addProviderPDFSection(doc,name,groups[supId],y);
  });

  const total=items.reduce((s,it)=>s+(Number(it.subtotal)||0),0);
  if(y>270){doc.addPage();pdfHeader(doc,'Lista de compra completa',orderDate);y=34;}
  doc.setFont('helvetica','bold');doc.setFontSize(11);
  doc.text(`Presupuesto total: ${money(total)}`,14,y);
  doc.save(`lista_compra_${orderDate}.pdf`);
}

function exportSupplierPDF(supId){
  if(typeof window.jspdf === 'undefined'){ showToast('No se pudo cargar el módulo de PDF'); return; }
  const items = currentPurchaseItems().filter(it=>{
    const p = state.products.find(pp=>pp.id===it.productId);
    return (p.supplierId||'none') === supId;
  });
  if(items.length===0) return;
  const supNameStr = supId==='none' ? 'Sin proveedor' : supName(supId);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  pdfHeader(doc, `Pedido para: ${supNameStr}`);
  const body = items.map(it => [it.name, `${it.qty} ${it.unit||''}`, money(it.cost), money(it.subtotal)]);
  doc.autoTable({
    startY: 34,
    head: [['Producto','Cantidad','Costo unit.','Subtotal']],
    body,
    styles:{fontSize:9, cellPadding:3},
    headStyles:{fillColor:[169,118,15]}
  });
  const total = items.reduce((s,it)=>s+it.subtotal,0);
  const y = doc.lastAutoTable.finalY + 10;
  doc.setFont('helvetica','bold'); doc.setFontSize(11);
  doc.text(`Total: ${money(total)}`, 14, y);
  doc.save(`pedido_${supNameStr.replace(/\s+/g,'_')}_${todayStr()}.pdf`);
}

