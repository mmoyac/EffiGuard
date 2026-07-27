## Why

El código de barras que trae la herramienta de fábrica no se guarda en ninguna parte. `assets.uid_fisico` es el único código del sistema y su función es identificar **esa unidad**, no el producto: tres atornilladores iguales son tres filas con tres UID distintos. El EAN/UPC del fabricante, que es el mismo en los tres, hoy simplemente se descarta.

Eso rompe el flujo de compra. Cuando llega una herramienta nueva, el bodeguero tiene que tipear a mano nombre, familia, valor de reposición y días de préstamo, aunque ya tenga tres unidades idénticas cargadas en el sistema. Y si le preguntan por el código de fábrica de algo, no hay dónde buscarlo.

Hay además un defecto que bloquea usar códigos universales: `uid_fisico` es `UNIQUE` a nivel global, no por tenant. Con códigos propios generados por EffiGuard la colisión entre clientes es improbable; con EAN de fabricante es la norma —dos clientes que le compran a Bosch chocan siempre— y el primero que registre el código deja a todos los demás fuera.

## What Changes

**Código de fabricante**

- Los activos incorporan `codigo_fabricante` (EAN/UPC/GTIN), opcional e indexado. No es único: las unidades del mismo producto lo comparten.
- Se agrega al formulario de activo, al listado, a la impresión de etiquetas y a la importación Excel.

**Unicidad de `uid_fisico` por tenant**

- **BREAKING**: la constraint `UNIQUE (uid_fisico)` pasa a `UNIQUE (tenant_id, uid_fisico)`. Dos tenants distintos pueden usar el mismo código físico, que es lo que permite cargar EAN de fabricante como UID de consumibles.
- El importador deja de rechazar filas con el motivo "uid_fisico pertenece a otro tenant".

**Resolución de escaneo en dos pasos**

- El escaneo busca primero coincidencia exacta de `uid_fisico`; si no la hay, busca por `codigo_fabricante`.
- Si el código de fabricante resuelve una sola unidad, se abre directo como hoy. Si resuelve varias, se ofrece la lista de unidades con su estado y ubicación para elegir cuál se opera.
- **BREAKING**: `GET /api/v1/assets/scan/{codigo}` pasa a devolver un sobre de resolución en lugar del activo plano, para poder expresar el caso de varias candidatas.

**Alta rápida de unidades por código de fabricante**

- Escanear un código de fabricante ya conocido permite crear una o varias unidades nuevas clonando los atributos del producto (nombre, familia, modelo, valor de reposición, días máximos de préstamo, unidad de medida), cada una con su `uid_fisico` autogenerado.
- Las unidades creadas se devuelven listas para imprimir sus etiquetas.

## Capabilities

### New Capabilities

Ninguna. El cambio extiende capacidades existentes.

### Modified Capabilities

- `catalogo-activos`: los activos incorporan el código de fabricante; la unicidad de `uid_fisico` pasa a ser por tenant; se agrega el alta de unidades clonando un producto conocido; la importación Excel gana la columna correspondiente.
- `escaneo`: la resolución de un código pasa a dos pasos y admite devolver varias unidades candidatas para que el operador elija.

## Impact

**Base de datos** — migración Alembic que agrega `assets.codigo_fabricante` con índice, elimina la constraint única global de `uid_fisico` y crea la compuesta `(tenant_id, uid_fisico)`.

**Backend** — `models/asset.py`, `schemas/asset.py` (sobre de resolución y alta por código), `services/asset.py` (`scan_asset()` y el alta clonada), `repositories/asset.py` (búsqueda por código de fabricante), `api/v1/assets.py`, `api/v1/import_assets.py` (columna nueva y eliminación del rechazo por colisión cross-tenant).

**Frontend** — `Scanner.tsx` (manejo del sobre de resolución), nuevo selector de unidad candidata, `ScanResult.tsx` (mostrar el código de fabricante), `EditAssetModal.tsx` y `AssetEdit.tsx`, `Assets.tsx`, `printLabel.ts`, `types/index.ts`, nuevo flujo de alta de unidades.

**Dependencia con otro cambio** — se apoya en `ubicacion-y-reintegro-consumibles`: el selector de unidades candidatas muestra la ubicación en bodega de cada una, y el alta clonada copia la unidad de medida. Conviene implementarlo después de aquel.

**Riesgo** — el cambio de la constraint y del contrato de `/assets/scan` no exige migración de datos ni ventana de mantención mientras el sistema no tenga usuarios en producción. El único consumidor de `/assets/scan` es el propio frontend; n8n usa `/assets/query`, que no cambia.
