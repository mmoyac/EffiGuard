# Inventario y Consumibles Specification

## Purpose

Controlar el stock de consumibles y dejar traza auditable de todo movimiento de bodega —entregas, devoluciones, compras, ajustes, mermas y pérdidas— sin generar préstamos para lo que no se devuelve.

## Requirements

### Requirement: Retiro de consumible sin préstamo

`POST /api/v1/loans/consumables/withdraw` SHALL descontar la cantidad solicitada de `stock_actual` y registrar un `InventoryLog` tipo `entrega` con el operario que retira y el proyecto opcional, sin crear ningún registro en `loans`.

#### Scenario: Activo prestable enviado al endpoint de consumibles

- **WHEN** la familia del activo no es `consumible`
- **THEN** responde 400 con "El activo no es un consumible"

#### Scenario: Stock insuficiente

- **WHEN** la cantidad solicitada supera el `stock_actual`
- **THEN** responde 400 con "Stock insuficiente" y el stock no se modifica

#### Scenario: Operario inexistente o de otro tenant

- **WHEN** el `operario_id` no existe o pertenece a otro tenant
- **THEN** responde 404 con "Operario no encontrado"

#### Scenario: Retiro válido

- **WHEN** hay stock suficiente y el operario es del tenant
- **THEN** el stock baja en la cantidad indicada y se crea el log con el nombre del operario

### Requirement: Registro de compra

`POST /api/v1/assets/{asset_id}/purchase` SHALL sumar unidades al stock de un consumible y registrar un log tipo `compra`.

#### Scenario: Cantidad no positiva

- **WHEN** la cantidad es menor o igual a cero
- **THEN** responde 400 con "La cantidad debe ser mayor a 0"

#### Scenario: Activo prestable

- **WHEN** el activo no es consumible
- **THEN** responde 400 con "Solo aplica a consumibles"

### Requirement: Ajuste de inventario a valor absoluto

`POST /api/v1/assets/{asset_id}/adjust` SHALL fijar `stock_actual` al valor absoluto indicado y registrar un log tipo `ajuste` con la magnitud de la diferencia.

#### Scenario: Ajuste sin observación

- **WHEN** no se envían observaciones
- **THEN** el log guarda automáticamente "Ajuste: <stock_anterior> → <stock_nuevo>"

### Requirement: Registro de merma

`POST /api/v1/assets/{asset_id}/shrinkage` SHALL descontar unidades de un consumible por daño, vencimiento o corrección a la baja, y registrar un log tipo `merma`.

#### Scenario: Merma mayor al stock

- **WHEN** la cantidad supera el `stock_actual`
- **THEN** responde 400 con "Stock insuficiente para registrar la merma"

### Requirement: Reporte de pérdida o robo

`POST /api/v1/assets/{asset_id}/loss` SHALL registrar un log tipo `perdida`, con comportamiento distinto según la familia: un activo prestable pasa a estado Robado (4) con cantidad 1; un consumible descuenta la cantidad reportada del stock.

#### Scenario: Herramienta robada

- **WHEN** se reporta pérdida de un activo prestable
- **THEN** el activo queda en estado Robado y el log registra cantidad 1

#### Scenario: Consumible perdido con stock insuficiente

- **WHEN** la cantidad reportada supera el stock del consumible
- **THEN** responde 400 con "Stock insuficiente"

### Requirement: Bitácora de movimientos

Todo movimiento de bodega SHALL quedar registrado en `inventory_logs` con tenant, activo, usuario ejecutor, operario receptor opcional, proyecto opcional, tipo de movimiento, cantidad, fecha-hora y observaciones. Los tipos usados son: `entrega`, `devolucion`, `ajuste`, `compra`, `perdida`, `merma`, `reparacion`, `reparacion_completada`.

#### Scenario: Listado de bitácora

- **WHEN** se consulta `GET /api/v1/inventory/logs`
- **THEN** devuelve los movimientos del tenant ordenados por fecha descendente, paginados (200 por defecto), enriquecidos con nombre del ejecutor, nombre del operario, nombre y UID del activo, y comportamiento y color de su familia

#### Scenario: Historial de un activo

- **WHEN** se consulta `GET /api/v1/inventory/logs/asset/{asset_id}`
- **THEN** devuelve todos los movimientos de ese activo, más recientes primero

### Requirement: Alerta de stock bajo

Un consumible SHALL considerarse bajo stock cuando `stock_actual <= stock_minimo`, y esa condición se refleja tanto en el listado dedicado como en el resultado de escaneo y el dashboard.

#### Scenario: Consumible en el mínimo exacto

- **WHEN** `stock_actual` es igual a `stock_minimo`
- **THEN** el activo se considera bajo stock
