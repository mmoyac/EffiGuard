## Why

El bodeguero no tiene dónde registrar en qué parte de la bodega está cada cosa. Cuando le piden una caja de tornillos tiene que ir a buscarla de memoria, y eso es justamente lo que el sistema debía evitar.

Además, hay consumibles que se despachan por medida —100 metros de cable a un proyecto— y de los que vuelve material sin usar. Hoy el sistema no tiene forma de recibir esos 20 metros de vuelta: la única salida sería registrarlos como pérdida, lo que contaminaría el indicador de robos con consumo legítimo de obra. Y aunque existiera el movimiento, las cantidades son enteras, así que "12,5 metros" no se puede registrar.

## What Changes

**Ubicación física en bodega**

- Nuevo catálogo `ubicaciones` por tenant: cada fila es una posición real de la bodega (rack, nivel, posición) con descripción opcional.
- Los activos (herramientas y consumibles) apuntan a una ubicación del catálogo mediante `ubicacion_id` opcional.
- El bodeguero elige la ubicación con selectores en cascada —rack, luego nivel, luego posición— y puede crear una ubicación nueva sin salir del formulario del activo.
- La ubicación se muestra en el resultado del escaneo, en el listado y la edición de activos, y viaja en la importación/exportación Excel.
- La consulta de disponibilidad para agentes externos devuelve la ubicación, para que el asistente de n8n responda "está en Rack 3, Nivel 5, Posición 11".
- Se puede filtrar el listado de activos por rack o por ubicación exacta.

**Reintegro de material sobrante**

- Nuevo movimiento `reintegro`: devuelve al stock el material no consumido de un despacho, imputado al mismo proyecto.
- El reintegro referencia el log de entrega original (`inventory_logs.origen_log_id`), lo que permite validar que no se devuelva más de lo despachado y calcular el consumo neto por despacho y por proyecto.
- Nuevo endpoint para listar los despachos de consumibles con saldo pendiente de reintegro.

**Cantidades decimales y unidad de medida**

- **BREAKING**: `assets.stock_actual`, `assets.stock_minimo` e `inventory_logs.cantidad` pasan de entero a `Numeric(12,3)`. Las respuestas de la API que hoy devuelven enteros pasarán a devolver decimales, lo que afecta al consumidor n8n.
- Los activos incorporan `unidad` (`unidad`, `metro`, `kilo`, `litro`) para que la interfaz muestre "80,5 m" en lugar de "80".

## Capabilities

### New Capabilities

Ninguna. El cambio extiende capacidades existentes.

### Modified Capabilities

- `catalogo-activos`: se agrega el catálogo de ubicaciones de bodega y los activos pasan a referenciarlo; los activos incorporan unidad de medida; el stock pasa a admitir decimales; la importación Excel gana las columnas correspondientes.
- `inventario-consumibles`: se agrega el movimiento de reintegro vinculado al despacho, con su validación de saldo; todos los movimientos pasan a manejar cantidades decimales expresadas en la unidad del activo.
- `escaneo`: el resultado del escaneo muestra la ubicación en bodega del activo y expresa el stock con su unidad.
- `integraciones`: la consulta de disponibilidad para agentes devuelve ubicación y unidad de medida.

## Impact

**Base de datos** — migración Alembic nueva que crea la tabla `ubicaciones` y agrega `assets.ubicacion_id` y `assets.unidad`, cambia el tipo de `stock_actual` y `stock_minimo`, y sobre `inventory_logs` agrega `origen_log_id` con FK autorreferencial y cambia el tipo de `cantidad`. El cambio de tipo entero → numeric conserva los valores existentes.

**Backend** — `models/ubicacion.py` (nuevo), `models/asset.py`, `models/inventory_log.py`, `repositories/ubicacion.py` (nuevo), `schemas/ubicacion.py` (nuevo), `schemas/asset.py`, `schemas/inventory.py`, `services/asset.py` (todas las operaciones de stock), `api/v1/ubicaciones.py` (nuevo), `api/v1/assets.py`, `api/v1/inventory.py`, `api/v1/import_assets.py` (columnas nuevas, resolución de ubicación y parseo decimal), `api/v1/dashboard.py` (`low-stock-detail` y la serie de movimientos suman decimales), `api/v1/router.py`.

**Frontend** — `ScanResult.tsx` (bloque de ubicación y stock con unidad), `UbicacionPicker.tsx` (nuevo, selectores en cascada con creación inline), `EditAssetModal.tsx` y `AssetEdit.tsx` (edición de ubicación y unidad), `Assets.tsx` (columna/tarjeta de ubicación y filtro por rack), `Inventory.tsx` (movimiento de reintegro en la bitácora), nuevo modal de reintegro en el flujo de escáner, `types/index.ts`.

**Navegación** — el catálogo de ubicaciones necesita su propia pantalla de mantención, lo que implica sembrar un `menu_item` y sus permisos para los roles admin y bodeguero.

**Integraciones** — el agente de n8n que consume `GET /assets/query` recibe campos nuevos y cantidades decimales; hay que revisar el workflow que formatea las respuestas.

**Riesgo** — el sistema aún no está en producción con usuarios reales, así que el cambio de tipo numérico no exige ventana de mantención ni migración de datos en caliente.
