## MODIFIED Requirements

### Requirement: Retiro de consumible sin préstamo

`POST /api/v1/variantes/{variante_id}/withdraw` SHALL descontar la cantidad solicitada de `stock_actual` de la variante y registrar un `InventoryLog` tipo `entrega` con el operario que retira y el proyecto opcional, sin crear ningún registro en `loans`.

#### Scenario: Variante prestable enviada al endpoint de consumibles

- **WHEN** la familia del producto de la variante no es `consumible`
- **THEN** responde 400 con "El item no es un consumible"

#### Scenario: Stock insuficiente

- **WHEN** la cantidad solicitada supera el `stock_actual` de la variante
- **THEN** responde 400 con "Stock insuficiente" y el stock no se modifica

#### Scenario: Operario inexistente o de otro tenant

- **WHEN** el `operario_id` no existe o pertenece a otro tenant
- **THEN** responde 404 con "Operario no encontrado"

#### Scenario: Retiro válido

- **WHEN** hay stock suficiente y el operario es del tenant
- **THEN** el stock de la variante baja en la cantidad indicada y se crea el log con el nombre del operario

#### Scenario: Retiro sobre una variante con varios proveedores

- **WHEN** se retiran 50 unidades de una variante que tiene códigos de tres proveedores
- **THEN** se descuentan de su único stock, sin preguntar de qué proveedor provienen

### Requirement: Registro de compra

`POST /api/v1/variantes/{variante_id}/purchase` SHALL sumar unidades al stock de una variante consumible y registrar un log tipo `compra`. La petición SHALL aceptar `cantidad` en unidades de stock, o bien `empaques` junto con el `codigo_id` del empaque escaneado, nunca ambos.

La compra SHALL registrar el proveedor en el movimiento. Cuando viene un `codigo_id`, el proveedor SHALL deducirse de ese código sin pedírselo al usuario; cuando no lo hay, la interfaz SHALL ofrecer los proveedores que ya tienen códigos en esa variante. El proveedor SHALL ser opcional y editable en ambos casos.

#### Scenario: Cantidad no positiva

- **WHEN** la cantidad es menor o igual a cero
- **THEN** responde 400 con "La cantidad debe ser mayor a 0"

#### Scenario: Variante prestable

- **WHEN** la variante no es consumible
- **THEN** responde 400 con "Solo aplica a consumibles"

#### Scenario: Compra por empaque

- **WHEN** se compran 3 empaques con un `codigo_id` de factor 100
- **THEN** el stock sube en 300 y el log registra `cantidad = 300`, con el empaque original en las observaciones

#### Scenario: Cajas de distinto contenido en la misma variante

- **WHEN** se compran 2 empaques con el código de factor 250 y después 3 con el de factor 100
- **THEN** el stock sube en 500 y luego en 300, porque cada código aporta su propio contenido

#### Scenario: Código de empaque de otra variante

- **WHEN** el `codigo_id` enviado pertenece a una variante distinta de la de la URL
- **THEN** responde 400 con "El código no pertenece a esta variante"

#### Scenario: Cantidad y empaques a la vez

- **WHEN** la petición envía `cantidad` y `empaques` simultáneamente, o ninguno de los dos
- **THEN** responde 422 con "Envíe cantidad o empaques, no ambos"

#### Scenario: Trazabilidad del origen

- **WHEN** la compra se registra con un `codigo_id`
- **THEN** el log conserva la referencia a ese código y el `proveedor_id` deducido de él, de modo que el movimiento sabe de quién y en qué empaque llegó, sin que el bodeguero haya tenido que elegirlo

#### Scenario: Compra tipeada a mano

- **WHEN** se registra una compra por `cantidad`, sin escanear ningún código
- **THEN** la interfaz ofrece como selección rápida los proveedores que ya tienen códigos en esa variante, y el elegido queda en el log

#### Scenario: Proveedor corregido sobre el deducido

- **WHEN** el bodeguero escanea un empaque de un proveedor pero cambia el proveedor en el formulario
- **THEN** el log guarda el proveedor elegido y conserva el `codigo_id` escaneado, dejando visible la discrepancia

#### Scenario: Compra sin proveedor

- **WHEN** no se escanea código ni se elige proveedor
- **THEN** la compra se registra igualmente con `proveedor_id` nulo

### Requirement: Ajuste de inventario a valor absoluto

`POST /api/v1/variantes/{variante_id}/adjust` SHALL fijar `stock_actual` de una variante consumible al valor absoluto indicado y registrar un log tipo `ajuste` con la magnitud de la diferencia.

#### Scenario: Ajuste sin observación

- **WHEN** no se envían observaciones
- **THEN** el log guarda automáticamente "Ajuste: <stock_anterior> → <stock_nuevo>"

#### Scenario: Ajuste sobre una variante prestable

- **WHEN** la variante pertenece a una familia prestable
- **THEN** responde 400 con "El stock de una herramienta se ajusta dando de alta o baja sus unidades"

### Requirement: Registro de merma

`POST /api/v1/variantes/{variante_id}/shrinkage` SHALL descontar unidades de una variante consumible por daño, vencimiento o corrección a la baja, y registrar un log tipo `merma`.

#### Scenario: Merma mayor al stock

- **WHEN** la cantidad supera el `stock_actual` de la variante
- **THEN** responde 400 con "Stock insuficiente para registrar la merma"

### Requirement: Reporte de pérdida o robo

El reporte de pérdida SHALL registrar un log tipo `perdida`, con endpoint y comportamiento distintos según el nivel: `POST /api/v1/unidades/{unidad_id}/loss` deja la unidad en estado Robado (4) con cantidad 1; `POST /api/v1/variantes/{variante_id}/loss` descuenta del stock la cantidad reportada de un consumible.

#### Scenario: Herramienta robada

- **WHEN** se reporta la pérdida de una unidad
- **THEN** la unidad queda en estado Robado, el log registra cantidad 1, y `unidades_disponibles` de su variante baja en 1

#### Scenario: Consumible perdido con stock insuficiente

- **WHEN** la cantidad reportada supera el stock de la variante
- **THEN** responde 400 con "Stock insuficiente"

### Requirement: Bitácora de movimientos

Todo movimiento de bodega SHALL quedar registrado en `inventory_logs` con tenant, **variante**, **unidad opcional**, **código opcional**, **proveedor opcional**, usuario ejecutor, operario receptor opcional, proyecto opcional, tipo de movimiento, cantidad, fecha-hora y observaciones. La variante SHALL estar siempre presente; la unidad sólo cuando el movimiento identifica un ejemplar concreto; el proveedor sólo en las compras. Los tipos usados son: `entrega`, `devolucion`, `ajuste`, `compra`, `perdida`, `reingreso`, `merma`, `reparacion`, `reparacion_completada`.

#### Scenario: Listado de bitácora

- **WHEN** se consulta `GET /api/v1/inventory/logs`
- **THEN** devuelve los movimientos del tenant ordenados por fecha descendente, paginados (200 por defecto), enriquecidos con nombre del ejecutor, nombre del operario, nombre de producto y variante, código principal de la unidad cuando la hay, y comportamiento y color de la familia

#### Scenario: Historial de una variante

- **WHEN** se consulta `GET /api/v1/inventory/logs/variante/{variante_id}`
- **THEN** devuelve todos los movimientos de esa variante —incluidos los de sus unidades—, más recientes primero

#### Scenario: Historial de una unidad

- **WHEN** se consulta `GET /api/v1/inventory/logs/unidad/{unidad_id}`
- **THEN** devuelve sólo los movimientos de ese ejemplar

#### Scenario: Movimiento de consumible sin unidad

- **WHEN** se registra el retiro de un consumible
- **THEN** el log guarda `variante_id` y deja `unidad_id` nulo

#### Scenario: Código eliminado después de un movimiento

- **WHEN** se elimina un código referenciado por logs de compra
- **THEN** los logs conservan su cantidad y su costo, y su `codigo_id` queda nulo

#### Scenario: Compras filtradas por proveedor

- **WHEN** se consulta la bitácora filtrando por `proveedor_id`
- **THEN** devuelve las compras registradas a ese proveedor, con su cantidad y costo unitario

## ADDED Requirements

### Requirement: Reingreso de un ejemplar dado por perdido

`POST /api/v1/unidades/{unidad_id}/reingreso` SHALL devolver a Disponible un ejemplar en estado Robado y registrar un movimiento tipo `reingreso` que apunta a la pérdida de origen.

La pérdida NO SHALL borrarse: ocurrió, y borrarla dejaría un robo sin rastro. Lo que cambia es que dejó de ser definitiva. El reingreso SHALL heredar el proyecto y el operario de la pérdida, y congelar el mismo costo con que se descontó.

Reportar una pérdida no puede ser un callejón sin salida: las herramientas aparecen —quedaron en otra camioneta, las tenía un maestro que no avisó—, y sin esta operación el ejemplar quedaría inutilizable para siempre.

#### Scenario: La herramienta aparece

- **WHEN** se reingresa un ejemplar en estado Robado
- **THEN** vuelve a Disponible, suma de nuevo a los ejemplares disponibles de su variante, y se registra el movimiento con la observación de dónde apareció

#### Scenario: Ejemplar que no estaba perdido

- **WHEN** se intenta reingresar un ejemplar en cualquier otro estado
- **THEN** responde 400 con "La unidad no está reportada como perdida"

#### Scenario: Trazabilidad de la reaparición

- **WHEN** se consulta la bitácora del ejemplar
- **THEN** aparecen la pérdida y el reingreso como dos hechos distintos, no uno que reemplaza al otro

## REMOVED Requirements

### Requirement: Alerta de stock bajo

**Reason**: La regla deja de aplicar sólo a consumibles. Con las herramientas modeladas como unidades, "quedan menos de 2 taladros disponibles" es la misma alerta expresada sobre un stock derivado, y mantener dos definiciones separadas llevaría a que el dashboard y el escaneo calcularan el quiebre de forma distinta según el comportamiento.

**Migration**: Lo cubre "Alerta de stock mínimo unificada" en `productos-y-variantes`, que compara `stock_minimo` contra el stock efectivo —`stock_actual` para consumibles, `unidades_disponibles` para prestables—. El comportamiento para consumibles es idéntico al anterior, con el agregado de que un `stock_minimo` en 0 desactiva la alerta.
