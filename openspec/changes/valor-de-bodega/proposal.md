## Why

EffiGuard sabe cuánto material hay en bodega y cuánto costó cada unidad, pero nunca responde la pregunta que hace el dueño: **cuánta plata tengo ahí parada**.

Las existencias son capital de trabajo congelado en una repisa — dinero que salió de la caja y no vuelve hasta que el material se consuma. Es una de las cifras que un CEO mira, y hoy hay que sacarla a mano.

El total por sí solo tampoco decide nada. Lo accionable es dónde está concentrada esa plata y hace cuánto que no se mueve: "$3,2 millones en un consumible que nadie toca hace ocho meses" es una decisión; "$8,4 millones en bodega" es un dato.

## What Changes

- Nuevo endpoint de valor de bodega, con **existencias y herramientas separadas**: las primeras son capital de trabajo valorizado a precio de compra, las segundas activo fijo valorizado a valor de reposición.
- Detalle de los activos que concentran el valor, cada uno con el tiempo transcurrido desde su último movimiento.
- Conteo de activos sin precio configurado, para que la brecha del total sea visible.
- Panel en el dashboard, junto al de gasto por obra.

## Capabilities

### New Capabilities

- `valor-de-bodega`: valorización del inventario en existencia y del parque de herramientas, con el detalle de dónde se concentra y su antigüedad de movimiento.

### Modified Capabilities

Ninguna.

## Impact

**Base de datos** — ninguna. Todo se calcula con datos existentes: `stock_actual`, `precio_compra`, `valor_reposicion` y la fecha del último movimiento en `inventory_logs`.

**Backend** — `repositories/asset.py` o un método de agregación equivalente, `api/v1/dashboard.py`, `schemas/inventory.py`.

**Frontend** — panel en `Dashboard.tsx`.

**Riesgo** — ninguno. Es una consulta de lectura sobre datos que ya existen.
