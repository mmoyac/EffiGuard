## Why

Hoy `assets` es una sola tabla que hace dos trabajos incompatibles: para un consumible una fila **es el producto** (lleva `stock_actual`), y para una herramienta una fila **es la unidad física** (lleva `uid_fisico` y se presta). Funcionó mientras el catálogo fue simple. Ya no lo es.

El caso que lo rompe: los mismos tornillos llegan de tres proveedores distintos, cada uno con su código de barras. `assets.codigo_fabricante` es **una** columna, así que sólo uno de los tres códigos se puede escanear. Las salidas son todas malas: crear tres activos "Tornillo 6x40" fragmenta el stock —"tengo 500" pasa a ser "180 + 220 + 100", y la alerta de stock mínimo deja de significar nada porque ninguno de los tres llega al mínimo mientras en total sobra material— o dejar dos de los tres códigos fuera del sistema, que es pedirle al bodeguero que tipee.

El mismo defecto tiene `contenido_por_empaque`: es un único valor por activo, pero la caja de un proveedor trae 100 unidades y la del otro 250. Hoy no hay dónde poner esa diferencia.

Es el momento de arreglarlo: el sistema todavía no está en producción con usuarios reales, así que el rediseño no arrastra datos de clientes ni exige compatibilidad hacia atrás. Cada semana que pase el costo sólo sube.

## What Changes

- **BREAKING** — `assets` se descompone en tres niveles: `productos` (el bien conceptual, sin stock), `variantes` (el SKU, **la** unidad de stock y de precio) y `unidades` (el ejemplar físico con `uid_fisico`, sólo para familias prestables).
- **BREAKING** — el stock de un consumible vive en su variante. El "stock" de una herramienta deja de almacenarse: es el conteo de sus unidades disponibles, calculado, para que no existan dos fuentes de verdad.
- **BREAKING** — los préstamos pasan a ser de una **unidad**, no de un activo. Los kits padre-hijo se arman entre unidades.
- **BREAKING** — la bitácora referencia siempre la variante y, cuando el movimiento es de una herramienta identificable, además la unidad.
- Nueva tabla `variante_codigos`: N códigos de barra por variante, cada uno con su tipo (`propio`, `proveedor`, `empaque`), su proveedor opcional y un **factor** de conversión. Un mismo tornillo puede tener el código de Sodimac, el de Construmart y el de la caja de 250 — todos resuelven a la misma variante y al mismo pozo de stock.
- El factor reemplaza a `contenido_por_empaque`: escanear el código de la caja de 100 ingresa 100 unidades; el de la caja de 250, 250. Cada empaque conoce su propio contenido.
- Nuevo catálogo `proveedores` por tenant, para etiquetar de quién viene cada código. Las compras registran el proveedor **deducido del código escaneado**, sin pedírselo al bodeguero.
- **BREAKING** — la importación Excel deja de escribir stock directamente: un `stock_actual` declarado se traduce en un movimiento registrado (apertura al crear, `ajuste` al actualizar), para que reimportar el template no pise inventario en silencio.
- La importación puede cargar ejemplares de herramienta: por cantidad con UID autogenerado, o una fila por ejemplar cuando ya vienen etiquetados.
- El escaneo resuelve **cualquier** código —UID de unidad o código de variante— con un solo endpoint, y desambigua cuando corresponde.
- **BREAKING** — `models` (marca + nombre) desaparece absorbido por `productos`, que es exactamente lo que esa tabla intentaba ser. `brands` se mantiene.
- Los atributos que distinguen variantes (medida, material, color) dejan de vivir enterrados en el texto de `nombre` y pasan a ser datos consultables.

## Capabilities

### New Capabilities

- `productos-y-variantes`: la jerarquía producto → variante → unidad, los atributos de variante, los códigos de barra múltiples con factor de empaque y el catálogo de proveedores.

### Modified Capabilities

- `catalogo-activos`: el UID físico deja de ser del activo y pasa a la unidad; la familia se ancla al producto; el alta y la importación Excel operan sobre la nueva jerarquía; la eliminación se valida por nivel.
- `escaneo`: la resolución deja de ser por `uid_fisico` y pasa a ser por cualquier código registrado, con desambiguación entre unidad y variante.
- `inventario-consumibles`: stock, compra, ajuste, merma y retiro pasan de `asset_id` a `variante_id`; la compra por empaque usa el factor del código escaneado.
- `prestamos`: el préstamo referencia una unidad; los kits se arman entre unidades; la disponibilidad de una herramienta se responde a nivel de variante ("quedan 3 de 7").
- `dashboard`: los quiebres de stock y el conteo de activos se calculan sobre variantes y unidades.
- `integraciones`: `GET /api/v1/assets/query` responde en términos de variantes y unidades disponibles.

## Impact

**Base de datos** — el cambio más grande hecho al esquema hasta ahora. Nuevas tablas `productos`, `variantes`, `variante_codigos`, `unidades`, `proveedores`. Se eliminan `assets` y `models`. `loans.asset_id` → `loans.unidad_id`; `inventory_logs.asset_id` → `variante_id` + `unidad_id` nullable. `ubicaciones` pasa a apuntar a variantes y unidades.

**Backend** — `models/` (cinco modelos nuevos, dos eliminados), `repositories/asset.py` se divide por entidad, `services/asset.py` y `services/loan.py`, y los routers `assets.py`, `loans.py`, `inventory.py`, `catalog.py`, `dashboard.py`, `import_assets.py`. Schemas `asset.py` e `inventory.py`.

**Frontend** — `Assets.tsx`, `AssetEdit.tsx`, `Scanner.tsx`, `Inventory.tsx`, `Dashboard.tsx`, `Ubicaciones.tsx`, los modales de `components/scanner/` y `components/assets/`.

**Cambios en vuelo** — dos changes sin archivar calculan sobre `assets` y quedan ciegos al catálogo nuevo:

- `valor-de-bodega` usa `assets.stock_actual` y `assets.precio_compra`.
- `costeo-por-proyecto` (capability `costeo-de-materiales`) alimenta el panel de gasto por obra con un join interno a `assets`, así que una obra abastecida con variantes aparece en cero.

Sus capabilities no están en `openspec/specs/`, de modo que no admiten delta desde acá: se listan como interacción y se reapuntan en el código, con la corrección definitiva cuando cada change se archive.

**Riesgo** — alto en superficie, bajo en consecuencia. Toca casi todo el backend de dominio, pero sin usuarios en producción no hay datos que preservar ni migración progresiva que orquestar: se rehace el esquema y se resiembra.
