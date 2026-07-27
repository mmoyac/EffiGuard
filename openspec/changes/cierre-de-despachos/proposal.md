## Why

Un despacho de consumible queda hoy abierto para siempre. Nada lo cierra: mientras tenga saldo sin devolver sigue apareciendo en la lista de reintegro, sin importar que hayan pasado seis meses ni que la obra a la que salió el material ya haya terminado.

Eso rompe dos cosas. La lista de reintegro se llena de despachos viejos y el bodeguero no encuentra el que busca. Y el consumo por proyecto —el dato que justificaba todo el mecanismo— queda distorsionado: una obra cerrada hace meses sigue mostrando material "sin devolver" que evidentemente se gastó.

Además, el modelo actual permite reintegrar varias veces contra un mismo despacho, algo que no ocurre en la operación real: el operario se lleva la caja, ocupa lo que ocupa y devuelve el resto en un solo viaje.

## What Changes

- Un despacho SHALL admitir **un solo reintegro**. El reintegro lo cierra: lo devuelto vuelve al stock y lo que no volvió queda declarado como consumo del proyecto.
- Un despacho también se cierra cuando **su proyecto se desactiva**: lo que salió a esa obra y no volvió pasa a ser consumo, sin quedar pendiente indefinidamente.
- La lista de despachos disponibles para reintegro SHALL mostrar sólo los abiertos: sin reintegro previo y de proyecto activo.
- Antes de confirmar, la interfaz SHALL mostrar la consecuencia completa —cuánto vuelve, cuánto queda como consumo y que la entrega se cierra— porque la operación deja de ser reversible.
- **No hay migración**: el cierre se deriva de los datos existentes, sin columnas ni estado nuevo.

## Capabilities

### New Capabilities

Ninguna. El cambio ajusta reglas de una capacidad existente.

### Modified Capabilities

- `inventario-consumibles`: el reintegro pasa a ser único por despacho y a cerrarlo; la lista de despachos pendientes se acota a los abiertos; se define el cierre por desactivación de proyecto.

## Impact

**Base de datos** — ninguna. El estado "abierto" se deriva de no tener reintegro y de que el proyecto esté activo. El cálculo del consumo (`entregas − reintegros`) no cambia en absoluto: el cierre afecta qué se ofrece en la lista, no la aritmética.

**Backend** — `repositories/inventory_log.py` (`despachos_pendientes` filtra por proyecto activo y ausencia de reintegro), `services/asset.py` (rechazar el segundo reintegro).

**Frontend** — `ReintegroModal.tsx` (confirmación explícita antes de guardar).

**Riesgo** — un reintegro con la cantidad mal tecleada ya no se puede corregir con un segundo reintegro. Se mitiga con la confirmación previa, y el ajuste de stock sigue disponible para corregir sin inventar un movimiento falso.
