## MODIFIED Requirements

### Requirement: Creación de préstamo de activo prestable

`POST /api/v1/loans` SHALL crear un préstamo para una **unidad** cuyo producto pertenece a una familia `prestable`, registrando operario receptor, bodeguero que entrega (el usuario del token), proyecto opcional y fecha de devolución prevista opcional. La unidad pasa a estado En Terreno (2) y se genera un log de inventario tipo `entrega` con su variante y su unidad.

#### Scenario: Variante consumible enviada al endpoint de préstamos

- **WHEN** el item referenciado es una variante de familia `consumible`
- **THEN** responde 400 con "Use el endpoint de consumibles para retirar consumibles"

#### Scenario: Unidad con préstamo ya abierto

- **WHEN** la unidad tiene un préstamo sin `fecha_devolucion_real`
- **THEN** responde 409 con "La unidad ya tiene un préstamo activo"

#### Scenario: Unidad inexistente

- **WHEN** el `unidad_id` no existe en el tenant
- **THEN** responde 404 con "Unidad no encontrada"

#### Scenario: Unidad no disponible

- **WHEN** la unidad está En Reparación o Robada
- **THEN** responde 400 con "La unidad no está disponible para préstamo"

### Requirement: Préstamo de kit completo en un escaneo

Al prestar una unidad padre con hijas, el sistema SHALL crear un préstamo por la padre y uno por cada hija, con el mismo operario, bodeguero y proyecto, dejando todas las unidades En Terreno y generando un log de entrega por cada una.

#### Scenario: Kit de tres piezas

- **WHEN** se presta una unidad padre con dos hijas
- **THEN** se crean tres préstamos y tres logs de entrega, y las tres unidades quedan en estado En Terreno

#### Scenario: Kit con una pieza no disponible

- **WHEN** una de las unidades hijas está En Reparación
- **THEN** responde 409 con "No se puede prestar el kit: la unidad '<codigo>' no está disponible" y no se crea ningún préstamo

### Requirement: Devolución validada contra el receptor

`POST /api/v1/loans/{loan_id}/return` SHALL exigir `returning_user_id`: quién trae la herramienta se confirma siempre, nunca se asume.

La devolución SHALL aceptarse aunque quien la trae no sea el titular del préstamo. La responsabilidad NO SHALL traspasarse: el préstamo sigue siendo de quien lo retiró, y el movimiento SHALL dejar constancia de quién la devolvió materialmente.

Bloquearla obligaría al bodeguero a quedarse con la herramienta en la mano y un préstamo que no puede cerrar cuando el titular se enfermó, renunció o está en otro frente — y ese callejón sin salida se resuelve en la práctica cerrando el préstamo "como si" lo devolviera el titular, que es peor que registrarlo.

#### Scenario: Devolución sin confirmar quién la trae

- **WHEN** la petición no incluye `returning_user_id`
- **THEN** se rechaza: la interfaz no SHALL suplirlo con el titular del préstamo, porque eso convierte la verificación en una comparación consigo misma

#### Scenario: La devuelve otro operario

- **WHEN** el `returning_user_id` no coincide con el `user_id` del préstamo
- **THEN** el préstamo se cierra igual, y el log de `devolucion` antepone "Devuelta materialmente por &lt;nombre&gt;" a las observaciones, conservando al titular como operario responsable

#### Scenario: Operario inexistente o de otro tenant

- **WHEN** el `returning_user_id` no existe o pertenece a otro tenant
- **THEN** responde 404 con "Operario no encontrado"

#### Scenario: Préstamo ya cerrado

- **WHEN** el préstamo tiene `fecha_devolucion_real` no nula
- **THEN** responde 400 con "El préstamo ya fue devuelto"

#### Scenario: Devolución correcta

- **WHEN** el operario coincide y el préstamo está abierto
- **THEN** se registra `fecha_devolucion_real`, la unidad vuelve a Disponible (1) y se crea un log tipo `devolucion` con las observaciones ingresadas

### Requirement: Devolución con envío a reparación

La devolución SHALL aceptar la marca `send_to_repair`; con ella la unidad queda en estado En Reparación (3) en lugar de Disponible y se registra un log adicional tipo `reparacion`.

#### Scenario: Herramienta devuelta dañada

- **WHEN** se devuelve con `send_to_repair = true`
- **THEN** la unidad queda En Reparación y se generan dos logs: `devolucion` y `reparacion` con la observación "Enviado a reparación al momento de la devolución"

### Requirement: Devolución en bloque de kits

Al devolver el préstamo de una unidad padre, el sistema SHALL cerrar también los préstamos activos de todas sus unidades hijas, aplicándoles el mismo estado final y generando sus logs correspondientes.

#### Scenario: Devolución de kit a reparación

- **WHEN** se devuelve un kit con `send_to_repair = true`
- **THEN** padre e hijas quedan En Reparación y cada una registra sus logs de `devolucion` y `reparacion`

### Requirement: Cierre de reparación

`POST /api/v1/unidades/{unidad_id}/repair-done` SHALL devolver a Disponible una unidad que está En Reparación y registrar un log tipo `reparacion_completada`.

#### Scenario: Unidad que no está en reparación

- **WHEN** la unidad no tiene estado En Reparación
- **THEN** responde 400 con "La unidad no está en estado 'En Reparación'"

### Requirement: Consulta de préstamos

El sistema SHALL exponer el listado de préstamos del tenant con filtro `active_only`, el préstamo activo de una unidad puntual, y los préstamos abiertos del operario autenticado. Todas las respuestas se enriquecen con nombre y RUT del operario, nombre del bodeguero, nombre del proyecto, y producto, variante y código principal de la unidad.

#### Scenario: Unidad sin préstamo abierto

- **WHEN** se consulta el préstamo activo de una unidad que está en bodega
- **THEN** responde `null`

#### Scenario: Vista "Mis préstamos"

- **WHEN** un operario consulta `GET /api/v1/loans/my`
- **THEN** recibe sólo sus préstamos sin devolución, ordenados por fecha de entrega descendente

### Requirement: Detección de préstamos vencidos

`GET /api/v1/dashboard/overdue-loans` SHALL listar los préstamos abiertos cuyos días transcurridos superan el límite efectivo de la unidad (override de la variante o herencia de la familia de su producto), ordenados por días de exceso descendente.

#### Scenario: Préstamo dentro del plazo

- **WHEN** los días transcurridos son menores o iguales al límite
- **THEN** el préstamo no aparece en la lista

#### Scenario: Unidad sin límite configurado

- **WHEN** ni la variante ni su familia definen `dias_max_prestamo`
- **THEN** el préstamo se excluye del cálculo de vencidos

## ADDED Requirements

### Requirement: Préstamo a partir de una variante

Cuando el escaneo resuelve a una variante prestable en vez de a una unidad concreta, el sistema SHALL ofrecer prestar uno de sus ejemplares disponibles, mostrando cuántos quedan.

#### Scenario: Variante con ejemplares libres

- **WHEN** se escanea el código de una variante prestable con 3 de 7 unidades disponibles
- **THEN** se muestra "3 de 7 disponibles" y se ofrece elegir una de las tres para prestar

#### Scenario: Variante sin ejemplares libres

- **WHEN** todas las unidades de la variante están En Terreno, En Reparación o Robadas
- **THEN** se informa "Sin unidades disponibles" y no se ofrece la acción de préstamo

#### Scenario: Selección automática con un solo disponible

- **WHEN** queda exactamente una unidad disponible
- **THEN** se preselecciona esa unidad y el bodeguero sólo confirma el operario
