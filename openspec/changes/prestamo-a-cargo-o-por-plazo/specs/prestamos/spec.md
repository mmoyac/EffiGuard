## ADDED Requirements

### Requirement: Modalidad de entrega del préstamo

Todo préstamo SHALL declarar su modalidad de entrega en `loans.modalidad`, con dos valores posibles:

- `plazo` — la herramienta vuelve. Puede llevar `fecha_devolucion_prevista`; si no la lleva, rige el límite del catálogo.
- `a_cargo` — la herramienta queda bajo la responsabilidad del operario hasta que la devuelva o se le retire. No hay fecha esperada y el sistema NUNCA SHALL reclamarla por vencimiento.

La modalidad `a_cargo` NO SHALL cambiar nada más del ciclo de vida: la unidad queda En Terreno (2), genera su log de `entrega`, aparece en las consultas de préstamos abiertos y se devuelve con el mismo endpoint y las mismas reglas que cualquier otro préstamo.

Cuando la petición no declara modalidad, el préstamo SHALL crearse como `plazo`.

#### Scenario: Entrega a cargo

- **WHEN** se crea un préstamo con `modalidad = a_cargo`
- **THEN** la unidad pasa a En Terreno con su log de `entrega`, el préstamo queda abierto sin fecha de devolución prevista, y no aparece en el listado de vencidos por más días que pasen

#### Scenario: Fecha prevista enviada junto con a cargo

- **WHEN** se crea un préstamo con `modalidad = a_cargo` y una `fecha_devolucion_prevista`
- **THEN** responde 400 con "Una entrega a cargo no lleva fecha de devolución", porque las dos cosas juntas no significan nada y aceptarlas dejaría un plazo que nadie va a hacer cumplir

#### Scenario: Modalidad no declarada

- **WHEN** la petición no incluye `modalidad`
- **THEN** el préstamo se crea como `plazo`, que es el comportamiento de siempre

#### Scenario: Modalidad desconocida

- **WHEN** la petición envía una modalidad distinta de `plazo` o `a_cargo`
- **THEN** responde 422, sin crear el préstamo

#### Scenario: Devolución de una herramienta entregada a cargo

- **WHEN** el operario trae una herramienta que tenía a cargo y se registra la devolución
- **THEN** el préstamo se cierra igual que cualquier otro, la unidad vuelve a Disponible y no queda ninguna asignación residual: si vuelve a salir a cargo del mismo operario, es un préstamo nuevo

### Requirement: Plazo pactado acotado por el límite del catálogo

Al crear un préstamo `plazo` con `fecha_devolucion_prevista`, el sistema SHALL rechazarlo cuando los días pedidos superen el límite efectivo de la unidad (override de la variante, o herencia de la familia de su producto).

El límite del catálogo pasa a ser el techo del acuerdo. Un plazo que lo excede sólo puede terminar en un préstamo que nace vencido, y el bodeguero no tiene por qué descubrirlo al día siguiente en el panel.

#### Scenario: Plazo por encima del límite

- **WHEN** se piden 30 días sobre una herramienta cuya familia limita a 5
- **THEN** responde 400 con "El plazo máximo para esta herramienta es de 5 días" y no se crea el préstamo

#### Scenario: Plazo dentro del límite

- **WHEN** se piden 3 días sobre una herramienta cuyo límite es 5
- **THEN** el préstamo se crea con esa fecha prevista

#### Scenario: Herramienta sin límite configurado

- **WHEN** ni la variante ni su familia definen `dias_max_prestamo`
- **THEN** se acepta cualquier plazo pactado, porque no hay techo contra el cual medirlo

#### Scenario: Necesidad que excede el límite

- **WHEN** el operario necesita la herramienta por más tiempo del que el catálogo permite
- **THEN** la salida es entregarla a cargo, no inflar el plazo: la interfaz SHALL ofrecer esa alternativa al informar el rechazo

## MODIFIED Requirements

### Requirement: Creación de préstamo de activo prestable

`POST /api/v1/loans` SHALL crear un préstamo para una **unidad** cuyo producto pertenece a una familia `prestable`, registrando operario receptor, bodeguero que entrega (el usuario del token), proyecto opcional, modalidad de entrega y fecha de devolución prevista opcional. La unidad pasa a estado En Terreno (2) y se genera un log de inventario tipo `entrega` con su variante y su unidad.

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

Al prestar una unidad padre con hijas, el sistema SHALL crear un préstamo por la padre y uno por cada hija, con el mismo operario, bodeguero, proyecto, modalidad y plazo, dejando todas las unidades En Terreno y generando un log de entrega por cada una.

Un kit no SHALL mezclar modalidades: no existe la caja entregada a cargo con una pieza a plazo. El kit vuelve entero o no vuelve, tal como ya lo trata la devolución en bloque.

#### Scenario: Kit de tres piezas

- **WHEN** se presta una unidad padre con dos hijas
- **THEN** se crean tres préstamos y tres logs de entrega, y las tres unidades quedan en estado En Terreno

#### Scenario: Kit con una pieza no disponible

- **WHEN** una de las unidades hijas está En Reparación
- **THEN** responde 409 con "No se puede prestar el kit: la unidad '<codigo>' no está disponible" y no se crea ningún préstamo

#### Scenario: Kit entregado a cargo

- **WHEN** se entrega a cargo un kit de tres piezas
- **THEN** los tres préstamos quedan en modalidad `a_cargo` y ninguno entra al cálculo de vencidos

### Requirement: Consulta de préstamos

El sistema SHALL exponer el listado de préstamos del tenant con filtro `active_only`, el préstamo activo de una unidad puntual, y los préstamos abiertos del operario autenticado. Todas las respuestas se enriquecen con nombre y RUT del operario, nombre del bodeguero, nombre del proyecto, producto, variante y código principal de la unidad, y la modalidad de entrega.

Lo entregado a cargo SHALL seguir apareciendo en estas consultas. No vence, pero no desaparece: sigue siendo una herramienta fuera de bodega con un responsable.

#### Scenario: Unidad sin préstamo abierto

- **WHEN** se consulta el préstamo activo de una unidad que está en bodega
- **THEN** responde `null`

#### Scenario: Vista "Mis préstamos"

- **WHEN** un operario consulta `GET /api/v1/loans/my`
- **THEN** recibe sólo sus préstamos sin devolución, ordenados por fecha de entrega descendente

#### Scenario: Distinción de lo entregado a cargo

- **WHEN** un operario tiene una herramienta a plazo y otra a cargo
- **THEN** ambas se listan, la de plazo con su fecha de devolución y la de a cargo identificada como tal, y esta última nunca se marca como atrasada

### Requirement: Detección de préstamos vencidos

`GET /api/v1/dashboard/overdue-loans` SHALL listar los préstamos abiertos que superaron su plazo, ordenados por días de exceso descendente, aplicando esta precedencia:

1. Modalidad `a_cargo` → nunca vence; queda fuera de la lista siempre.
2. Con `fecha_devolucion_prevista` → vence cuando esa fecha ya pasó. El plazo pactado en el mesón manda sobre el límite del catálogo, porque el bodeguero sabía algo que el catálogo no sabe.
3. Sin fecha pactada → rige el límite efectivo de la unidad (override de la variante o herencia de la familia de su producto).
4. Sin fecha pactada y sin límite en el catálogo → el préstamo se excluye del cálculo.

Cada préstamo vencido SHALL indicar de dónde sale el plazo incumplido: `pactado` o `catalogo`.

#### Scenario: Préstamo dentro del plazo pactado

- **WHEN** el préstamo tiene fecha prevista para dentro de dos días
- **THEN** no aparece en la lista, aunque los días transcurridos ya superen el `dias_max_prestamo` del catálogo

#### Scenario: Préstamo pasado de la fecha pactada

- **WHEN** la fecha prevista fue anteayer
- **THEN** aparece en la lista con 2 días de exceso y origen `pactado`, aunque el límite del catálogo sea más largo

#### Scenario: Préstamo sin fecha pactada

- **WHEN** no hay fecha prevista y los días transcurridos superan el límite de la variante o su familia
- **THEN** aparece en la lista con origen `catalogo`

#### Scenario: Herramienta entregada a cargo

- **WHEN** una herramienta lleva ocho meses a cargo de un operario y su familia limita los préstamos a 5 días
- **THEN** no aparece en la lista, porque nadie le pidió que volviera

#### Scenario: Unidad sin límite configurado

- **WHEN** no hay fecha pactada y ni la variante ni su familia definen `dias_max_prestamo`
- **THEN** el préstamo se excluye del cálculo de vencidos
