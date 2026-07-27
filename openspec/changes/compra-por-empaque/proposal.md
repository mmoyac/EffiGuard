## Why

El stock de un consumible se lleva en la unidad en que se despacha —tornillos, metros— porque es la única en la que el reintegro tiene sentido: cuando de un rollo de 100 metros vuelven 20, eso son 20 metros, no 0,2 rollos.

Pero la compra ocurre en la otra unidad. Al bodeguero le llegan 3 cajas de 100 tornillos, y hoy tiene que anotar 300 a mano. Esa multiplicación mental es una fuente de descuadre: tarde o temprano alguien registra 3 en vez de 300 y el inventario queda mal sin que nadie lo note.

## What Changes

- Los activos incorporan `contenido_por_empaque` (cuántas unidades trae cada caja, rollo o tambor) y `nombre_empaque` (cómo se llama ese envase), ambos opcionales.
- `POST /assets/{id}/purchase` acepta `empaques` como alternativa a `cantidad`: recibir "llegaron 3 cajas" suma 300 al stock automáticamente.
- El movimiento de compra queda registrado en la unidad de stock (300), y su observación deja constancia del empaque original ("3 cajas de 100 unidad").
- La interfaz muestra la equivalencia donde el dato ayuda: "9.000 un. (90 cajas)".
- La importación Excel gana las dos columnas correspondientes.

## Capabilities

### New Capabilities

Ninguna. El cambio extiende capacidades existentes.

### Modified Capabilities

- `catalogo-activos`: los activos incorporan el contenido por empaque y el nombre del envase; la importación Excel gana las columnas correspondientes.
- `inventario-consumibles`: el registro de compra acepta cantidad de empaques además de cantidad de unidades.

## Impact

**Base de datos** — migración Alembic que agrega `assets.contenido_por_empaque` (`Numeric(12,3)`, nulo) y `assets.nombre_empaque` (`varchar(20)`, nulo).

**Backend** — `models/asset.py`, `schemas/asset.py` (`AssetPurchase` con `empaques`), `services/asset.py` (`purchase_stock`), `api/v1/import_assets.py`.

**Frontend** — `types/index.ts`, `EditAssetModal.tsx` y `AssetEdit.tsx` (configurar el empaque), `ScanResult.tsx` y `Assets.tsx` (mostrar la equivalencia).

**Riesgo** — bajo. Ambos campos son opcionales y su ausencia deja el comportamiento actual intacto: quien no configure empaque sigue comprando por unidades exactamente como hoy.
