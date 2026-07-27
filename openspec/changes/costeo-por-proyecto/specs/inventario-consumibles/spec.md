## MODIFIED Requirements

### Requirement: Bitácora de movimientos

Todo movimiento de bodega SHALL quedar registrado en `inventory_logs` con tenant, activo, usuario ejecutor, operario receptor opcional, proyecto opcional, movimiento de origen opcional, tipo de movimiento, cantidad, costo unitario vigente al ocurrir, fecha-hora y observaciones. Los tipos usados son: `entrega`, `devolucion`, `ajuste`, `compra`, `perdida`, `merma`, `reintegro`, `reparacion` y `reparacion_completada`.

#### Scenario: Listado de bitácora

- **WHEN** se consulta `GET /api/v1/inventory/logs`
- **THEN** devuelve los movimientos del tenant ordenados por fecha descendente, paginados (200 por defecto), enriquecidos con nombre del ejecutor, nombre del operario, nombre y UID del activo, unidad de medida, proyecto, y comportamiento y color de su familia

#### Scenario: Costo del movimiento

- **WHEN** el activo tenía precio configurado al momento del movimiento
- **THEN** el movimiento muestra su costo total, calculado como cantidad por costo unitario congelado

#### Scenario: Movimiento sin costo

- **WHEN** el activo no tenía precio configurado
- **THEN** el movimiento se muestra sin costo, distinguiéndose de un costo de cero

#### Scenario: Historial de un activo

- **WHEN** se consulta `GET /api/v1/inventory/logs/asset/{asset_id}`
- **THEN** devuelve todos los movimientos de ese activo, más recientes primero

#### Scenario: Reintegro en la bitácora

- **WHEN** se lista un movimiento de tipo `reintegro`
- **THEN** se distingue visualmente de una `compra` y muestra a qué despacho corresponde
