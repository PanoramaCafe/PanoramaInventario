# Estructura del proyecto — Panorama Café Inventario

Guía rápida para ubicar qué archivo tocar cuando necesites hacer un ajuste.

## Cómo está armado

Es una PWA estática (sin build step, sin npm, sin backend propio) pensada
para vivir en GitHub Pages tal cual. Por eso el JavaScript **no usa módulos
ES** (`import`/`export`): son scripts clásicos que se cargan uno tras otro
en `index.html` y comparten el mismo scope global — igual que ya funcionaba
`sync.js` antes de esta reorganización.

**Esto significa dos cosas importantes:**

1. **El orden de los `<script>` en `index.html` importa.** Un archivo puede
   usar funciones o variables definidas en un archivo anterior de la lista,
   pero no en uno posterior. No reordenes los `<script src="js/...">` sin
   revisar las dependencias.
2. No hace falta configurar nada para desarrollar: abrir `index.html` (o
   publicarlo tal cual en GitHub Pages) ya sirve toda la app.

## Orden de carga y qué contiene cada archivo

| # | Archivo | Qué vive ahí | Tócalo cuando quieras... |
|---|---------|--------------|---------------------------|
| 1 | `js/01-storage.js` | Estado global (`state`, `ui`), guardado/carga en `localStorage`, helpers genéricos (`uid`, `esc`, `money`, fechas) | Cambiar cómo se guarda/carga la app, agregar un campo nuevo al estado global |
| 2 | `js/02-render.js` | `render()` (router de pestañas) y el Dashboard | Cambiar qué se ve en el dashboard, agregar una pestaña nueva |
| 3 | `js/03-catalogo.js` | Listado y acciones de **Productos, Categorías, Proveedores** | Cambiar la tabla de productos, filtros, columnas visibles |
| 4 | `js/04-datos-excel-pwa.js` | Pestaña "Datos y app": **exportar/importar Excel**, respaldo JSON, instalación PWA, texto de ayuda de Loyverse | Agregar/quitar columnas del Excel exportado, cambiar el importador |
| 5 | `js/05-stock-conteo.js` | Modelo de stock físico (`stockMode`: piezas / medida exacta / bodega+uso / nivel) y **Conteo físico de inventario** | Cambiar cómo se calcula el stock, agregar un modo de stock nuevo |
| 6 | `js/06-recetas.js` | Recetas y registro de producción (descuenta insumos) | Cambiar cómo se descuentan ingredientes al producir algo |
| 7 | `js/07-compras.js` | Compatibilidad de presentaciones de compra + Lista de compra sugerida | Cambiar la lógica de "qué comprar" |
| 8 | `js/08-modal.js` | Sistema de modal genérico (abrir/cerrar) | Cambiar el comportamiento general de TODOS los formularios (son modales) |
| 9 | `js/09-form-producto.js` | Formulario de alta/edición de producto (incluye "¿cómo lo compras?" y selección de modo de stock) | **Este es el archivo que más vas a tocar** — aquí se define cada campo del formulario de producto |
| 10 | `js/10-form-costo-ajuste.js` | Formulario "registrar nuevo costo/mercancía" + formulario de ajuste de stock (merma, daño, uso interno) | Cambiar cómo se registra una compra nueva o un ajuste manual |
| 11 | `js/11-form-cat-prov.js` | Formularios de categoría y proveedor | Agregar campos a categoría/proveedor |
| 12 | `js/12-exportar-texto.js` | Exportar listas en texto plano/CSV (compartir por WhatsApp, copiar) | Cambiar el formato de texto que se comparte |
| 13 | `js/13-loza.js` | **Inventario de Loza/cristalería** — módulo independiente (`state.loza`), no toca productos/categorías/proveedores ni la lista de compra de insumos | Vasos, platos, cubiertos, cristalería: cantidades, historial de roturas/pérdidas, presupuesto de reposición, export Excel/PDF propio |
| 14 | `js/14-eventos.js` | Conecta todos los botones/inputs de la UI con sus funciones, y al final llama `loadState()` para arrancar la app | Agregar un botón nuevo en cualquier pantalla |
| 15 | `js/15-sync-supabase.js` | Sincronización con Supabase: carga inicial, subida con espera de 350ms, tiempo real, migración de productos antiguos | Cualquier tema de sincronización en la nube / Supabase |

`sw.js` (service worker) e `icon-*.png` no cambiaron — siguen igual.

## Preguntas frecuentes de mantenimiento

**"Quiero agregar un campo nuevo a producto (ej. fecha de caducidad)"**
→ `js/09-form-producto.js` (agregar el campo al formulario) y
`js/01-storage.js` si necesitas inicializarlo por default en productos
nuevos. Si quieres que también salga en el Excel, agrégalo en
`js/04-datos-excel-pwa.js` (función `exportExcelWorkbook`).

**"Los datos no se guardan / se revierten al recargar"**
→ Revisa `js/01-storage.js` (guardado local) y `js/14-sync-supabase.js`
(sincronización con Supabase — ahí vive `inferMode()`, que ya tuvo un bug
de nombres de modos de stock, corregido).

**"Quiero cambiar cómo se ve una tabla o tarjeta"**
→ Busca la pestaña correspondiente: productos/categorías/proveedores en
`js/03-catalogo.js`, dashboard en `js/02-render.js`.

**"Agregué un botón nuevo en el HTML pero no hace nada"**
→ Falta conectarlo en `js/14-eventos.js` (ahí es donde se asignan los
`onclick`/`onchange` a los elementos del DOM).

**"Quiero agregar un arreglo nuevo a `state` (como se hizo con `state.loza`)"**
→ Tres lugares obligatorios, o se te va a "desaparecer" el dato:
1. `js/01-storage.js`: default en `let state = {...}` y en `loadState()`.
2. `js/15-sync-supabase.js`, función `normalize()`: agrégalo a la lista
   explícita de claves. **Este paso es fácil de olvidar y es justo lo que
   causó el bug de que las ediciones se revirtieran** — `normalize()`
   reconstruye `state` desde cero en cada sincronización y borra
   silenciosamente cualquier clave que no esté ahí.
3. Si tiene su propio tab, agrégalo al router en `js/02-render.js`.

**"Quiero un inventario nuevo y separado, tipo Loza"**
→ Usa `js/13-loza.js` como plantilla: arreglo propio en `state`, tab
propio, formulario propio, export Excel/PDF propio. No mezcles el arreglo
nuevo dentro de `state.products`.
