## Why

EffiGuard sabe cuánto material salió a cada proyecto, pero no cuánto costó. El jefe de bodega ve que se consumieron 9.000 tornillos y no puede decir cuánta plata es eso.

Hay una segunda razón, más cercana al propósito del sistema: las pérdidas se reportan hoy en unidades. Un robo expresado en pesos es lo que obliga a alguien a explicarlo; "una lijadora robada" se lee y se pasa de largo.

## What Changes

- Los consumibles incorporan `precio_compra`: cuánto cuesta una unidad de stock.
- Cada movimiento de inventario congela el costo unitario vigente al momento de ocurrir (`inventory_logs.costo_unitario`), de modo que un proyecto costeado hoy no cambie de valor cuando suba el precio mañana.
- Nuevo endpoint de costo de materiales por proyecto, con el consumo, las pérdidas y las mermas en **líneas separadas**.
- Panel de costo de materiales en el dashboard.
- Los movimientos sin precio configurado se informan como no valorizados, en vez de contarse como cero.

## Capabilities

### New Capabilities

- `costeo-de-materiales`: valorización del material consumido, perdido y mermado, imputado a cada proyecto.

### Modified Capabilities

- `catalogo-activos`: los consumibles incorporan precio de compra.
- `inventario-consumibles`: cada movimiento congela el costo unitario vigente al ocurrir.

## Impact

**Base de datos** — migración que agrega `assets.precio_compra` (`Numeric(12,2)`, nulo) e `inventory_logs.costo_unitario` (`Numeric(12,4)`, nulo).

**Backend** — `models/asset.py`, `models/inventory_log.py`, `schemas/asset.py`, `schemas/inventory.py`, `services/asset.py` (estampar el costo en cada movimiento), `repositories/inventory_log.py` (agregaciones valorizadas), `api/v1/dashboard.py`, `api/v1/import_assets.py`.

**Frontend** — `types/index.ts`, formularios de edición de consumible, panel de costos en `Dashboard.tsx`, costo del movimiento en `Inventory.tsx`.

**Fuera de alcance, deliberadamente** — costo de uso de herramientas, mano de obra, fletes y márgenes. Son costeo de órdenes de trabajo, no gestión de bodega. Quedan documentados en `openspec/notas/costeo-de-ordenes.md` para retomarlos si el negocio lo pide.

**Riesgo** — bajo. `precio_compra` es opcional: sin precio configurado el costeo devuelve cero valorizado y el resto del sistema funciona igual. Los movimientos anteriores al cambio quedan sin costo y se reportan aparte.
