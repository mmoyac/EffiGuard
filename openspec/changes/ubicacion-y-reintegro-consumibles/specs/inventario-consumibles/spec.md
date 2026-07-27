## ADDED Requirements

### Requirement: Reintegro de material sobrante

El sistema SHALL permitir devolver al stock el material despachado que no se consumió, mediante un movimiento `reintegro` que referencia el despacho de origen. El reintegro suma la cantidad al `stock_actual` y hereda el proyecto y el operario del despacho referenciado.

#### Scenario: Vuelve material de un despacho

- **WHEN** se despacharon 100 metros de cable al Proyecto X y vuelven 20
- **THEN** el stock sube 20 metros, se registra un log `reintegro` de 20 que referencia el despacho, y el consumo neto del Proyecto X por ese despacho queda en 80 metros

#### Scenario: Reintegro mayor al saldo pendiente

- **WHEN** se intenta reintegrar 30 metros contra un despacho de 100 que ya tiene 80 reintegrados
- **THEN** responde 400 indicando el saldo pendiente disponible, y el stock no se modifica

#### Scenario: Reintegro sobre un despacho de otro activo o de otro tenant

- **WHEN** el movimiento de origen no corresponde al activo indicado o pertenece a otro tenant
- **THEN** responde 404 sin revelar la existencia del movimiento

#### Scenario: Origen que no es un despacho de consumible

- **WHEN** el movimiento referenciado no es de tipo `entrega` o el activo no es consumible
- **THEN** responde 400 indicando que sólo se puede reintegrar contra despachos de consumibles

#### Scenario: Cantidad no positiva

- **WHEN** la cantidad a reintegrar es menor o igual a cero
- **THEN** responde 400 con "La cantidad debe ser mayor a 0"

#### Scenario: Reintegros parciales sucesivos

- **WHEN** contra un despacho de 100 metros se reintegran primero 20 y luego 15
- **THEN** ambos movimientos quedan registrados, el stock sube 35 en total y el saldo pendiente del despacho queda en 65

### Requirement: Saldo pendiente de los despachos

El sistema SHALL exponer, por consumible, los despachos con saldo pendiente de reintegro, entendido como la cantidad entregada menos la suma de los reintegros que la referencian. El saldo se calcula al consultar, no se almacena.

#### Scenario: Consulta de despachos pendientes de un consumible

- **WHEN** se consultan los despachos con saldo de un consumible
- **THEN** devuelve cada despacho con su proyecto, operario, fecha y saldo pendiente, más recientes primero

#### Scenario: Despacho completamente reintegrado

- **WHEN** un despacho ya fue reintegrado en su totalidad
- **THEN** deja de aparecer en la lista de saldos pendientes

#### Scenario: Saldo sin cierre explícito

- **WHEN** un despacho queda con saldo pendiente porque el material se consumió en obra y nadie lo informa
- **THEN** el saldo permanece como dato informativo y no bloquea ninguna operación sobre el activo

### Requirement: Consumo neto por proyecto

El consumo real de un proyecto SHALL calcularse como la suma de los despachos imputados menos la suma de sus reintegros, distinguiéndolo de la cantidad simplemente retirada.

#### Scenario: Proyecto con material devuelto

- **WHEN** un proyecto recibió 100 metros y devolvió 20
- **THEN** su consumo neto es 80 metros, no 100

### Requirement: Cantidades decimales expresadas en la unidad del activo

Todos los movimientos de inventario SHALL manejar cantidades con hasta tres decimales, con aritmética decimal exacta, y presentarlas acompañadas de la unidad de medida del activo.

#### Scenario: Retiro de una medida fraccionaria

- **WHEN** se retiran 12,5 metros de un consumible medido en metros
- **THEN** el stock baja exactamente 12,5 y la bitácora registra "12,5 m"

#### Scenario: Consumible contado por unidades

- **WHEN** el activo tiene unidad `unidad`
- **THEN** las cantidades se muestran sin decimales innecesarios

## MODIFIED Requirements

### Requirement: Bitácora de movimientos

Todo movimiento de bodega SHALL quedar registrado en `inventory_logs` con tenant, activo, usuario ejecutor, operario receptor opcional, proyecto opcional, movimiento de origen opcional, tipo de movimiento, cantidad, fecha-hora y observaciones. Los tipos usados son: `entrega`, `devolucion`, `ajuste`, `compra`, `perdida`, `merma`, `reintegro`, `reparacion` y `reparacion_completada`.

#### Scenario: Listado de bitácora

- **WHEN** se consulta `GET /api/v1/inventory/logs`
- **THEN** devuelve los movimientos del tenant ordenados por fecha descendente, paginados (200 por defecto), enriquecidos con nombre del ejecutor, nombre del operario, nombre y UID del activo, unidad de medida, y comportamiento y color de su familia

#### Scenario: Historial de un activo

- **WHEN** se consulta `GET /api/v1/inventory/logs/asset/{asset_id}`
- **THEN** devuelve todos los movimientos de ese activo, más recientes primero

#### Scenario: Reintegro en la bitácora

- **WHEN** se lista un movimiento de tipo `reintegro`
- **THEN** se distingue visualmente de una `compra` y muestra a qué despacho corresponde
