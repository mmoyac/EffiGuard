# Préstamos de Herramientas Specification

## Purpose

Registrar la entrega y devolución de activos prestables, incluyendo kits completos, con trazabilidad de quién entrega, quién recibe y a qué proyecto, y detección de préstamos vencidos.

## Requirements

### Requirement: Creación de préstamo de activo prestable

`POST /api/v1/loans` SHALL crear un préstamo para un activo cuya familia es `prestable`, registrando operario receptor, bodeguero que entrega (el usuario del token), proyecto opcional y fecha de devolución prevista opcional. El activo pasa a estado En Terreno (2) y se genera un log de inventario tipo `entrega`.

#### Scenario: Activo consumible enviado al endpoint de préstamos

- **WHEN** el activo pertenece a una familia `consumible`
- **THEN** responde 400 con "Use el endpoint de consumibles para retirar consumibles"

#### Scenario: Activo con préstamo ya abierto

- **WHEN** el activo tiene un préstamo sin `fecha_devolucion_real`
- **THEN** responde 409 con "El activo ya tiene un préstamo activo"

#### Scenario: Activo inexistente

- **WHEN** el `asset_id` no existe en el tenant
- **THEN** responde 404 con "Activo no encontrado"

### Requirement: Préstamo de kit completo en un escaneo

Al prestar un activo padre con hijos, el sistema SHALL crear un préstamo por el padre y uno por cada hijo, con el mismo operario, bodeguero y proyecto, dejando todos los activos En Terreno y generando un log de entrega por cada uno.

#### Scenario: Kit de tres piezas

- **WHEN** se presta un padre con dos hijos
- **THEN** se crean tres préstamos y tres logs de entrega, y los tres activos quedan en estado En Terreno

### Requirement: Devolución validada contra el receptor

`POST /api/v1/loans/{loan_id}/return` SHALL cerrar el préstamo sólo si quien devuelve es el mismo operario que lo recibió.

#### Scenario: Operario distinto al que retiró

- **WHEN** el `returning_user_id` no coincide con el `user_id` del préstamo
- **THEN** responde 403 con "El operario no coincide con quien retiró la herramienta"

#### Scenario: Préstamo ya cerrado

- **WHEN** el préstamo tiene `fecha_devolucion_real` no nula
- **THEN** responde 400 con "El préstamo ya fue devuelto"

#### Scenario: Devolución correcta

- **WHEN** el operario coincide y el préstamo está abierto
- **THEN** se registra `fecha_devolucion_real`, el activo vuelve a Disponible (1) y se crea un log tipo `devolucion` con las observaciones ingresadas

### Requirement: Devolución con envío a reparación

La devolución SHALL aceptar la marca `send_to_repair`; con ella el activo queda en estado En Reparación (3) en lugar de Disponible y se registra un log adicional tipo `reparacion`.

#### Scenario: Herramienta devuelta dañada

- **WHEN** se devuelve con `send_to_repair = true`
- **THEN** el activo queda En Reparación y se generan dos logs: `devolucion` y `reparacion` con la observación "Enviado a reparación al momento de la devolución"

### Requirement: Devolución en bloque de kits

Al devolver el préstamo de un activo padre, el sistema SHALL cerrar también los préstamos activos de todos sus hijos, aplicándoles el mismo estado final y generando sus logs correspondientes.

#### Scenario: Devolución de kit a reparación

- **WHEN** se devuelve un kit con `send_to_repair = true`
- **THEN** padre e hijos quedan En Reparación y cada uno registra sus logs de `devolucion` y `reparacion`

### Requirement: Cierre de reparación

`POST /api/v1/assets/{asset_id}/repair-done` SHALL devolver a Disponible un activo que está En Reparación y registrar un log tipo `reparacion_completada`.

#### Scenario: Activo que no está en reparación

- **WHEN** el activo no tiene estado En Reparación
- **THEN** responde 400 con "El activo no está en estado 'En Reparación'"

### Requirement: Consulta de préstamos

El sistema SHALL exponer el listado de préstamos del tenant con filtro `active_only`, el préstamo activo de un activo puntual, y los préstamos abiertos del operario autenticado. Todas las respuestas se enriquecen con nombre y RUT del operario, nombre del bodeguero, nombre del proyecto y UID/nombre del activo.

#### Scenario: Activo sin préstamo abierto

- **WHEN** se consulta el préstamo activo de un activo que está en bodega
- **THEN** responde `null`

#### Scenario: Vista "Mis préstamos"

- **WHEN** un operario consulta `GET /api/v1/loans/my`
- **THEN** recibe sólo sus préstamos sin devolución, ordenados por fecha de entrega descendente

### Requirement: Detección de préstamos vencidos

`GET /api/v1/dashboard/overdue-loans` SHALL listar los préstamos abiertos cuyos días transcurridos superan el límite efectivo del activo (override propio o herencia de familia), ordenados por días de exceso descendente.

#### Scenario: Préstamo dentro del plazo

- **WHEN** los días transcurridos son menores o iguales al límite
- **THEN** el préstamo no aparece en la lista

#### Scenario: Activo sin límite configurado

- **WHEN** ni el activo ni su familia definen `dias_max_prestamo`
- **THEN** el préstamo se excluye del cálculo de vencidos
