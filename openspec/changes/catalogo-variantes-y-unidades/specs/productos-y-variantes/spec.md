## ADDED Requirements

### Requirement: Jerarquía producto → variante → unidad

El catálogo SHALL organizarse en tres niveles: `productos` (el bien conceptual, sin stock ni precio), `variantes` (el SKU, única posición de stock y de precio) y `unidades` (el ejemplar físico). Un producto SHALL tener al menos una variante. Una variante SHALL tener unidades sólo si el comportamiento de su producto es `prestable`.

#### Scenario: Producto consumible con variantes

- **WHEN** se consulta un producto de familia consumible
- **THEN** devuelve sus variantes con su stock, y ninguna de ellas tiene unidades asociadas

#### Scenario: Producto prestable con ejemplares

- **WHEN** se consulta un producto de familia prestable
- **THEN** cada variante devuelve su conteo de unidades totales y disponibles

#### Scenario: Intento de crear unidades en una variante consumible

- **WHEN** se crean unidades para una variante cuyo producto es de familia `consumible`
- **THEN** responde 400 con "Sólo las familias prestables tienen unidades"

#### Scenario: Producto sin variantes

- **WHEN** se elimina la última variante de un producto
- **THEN** responde 409 con "No se puede eliminar: el producto quedaría sin variantes"

### Requirement: Alta en un solo formulario con variante implícita

El alta de catálogo SHALL crear producto y variante en una sola operación. Si la petición no declara variantes, el sistema SHALL crear una variante homónima del producto. Declarar variantes SHALL ser opcional.

#### Scenario: Alta sin variantes declaradas

- **WHEN** se crea "Silicona neutra transparente" sin declarar variantes
- **THEN** se crea el producto y una única variante con el mismo nombre, que recibe el stock mínimo, la unidad y el precio enviados

#### Scenario: Alta desde la interfaz

- **WHEN** el bodeguero crea un producto desde el catálogo
- **THEN** el formulario pide nombre, familia, marca opcional y los datos operativos de la variante, y crea ambos niveles sin exigir un segundo paso

#### Scenario: Alta con variantes declaradas

- **WHEN** se crea "Tornillo autoperforante" declarando las variantes "6x40 zincado" y "8x60 inoxidable"
- **THEN** se crea un producto con dos variantes, cada una con su propio stock y stock mínimo

#### Scenario: Variante agregada a un producto existente

- **WHEN** se agrega una variante a un producto que ya tiene una
- **THEN** la nueva variante convive con la existente sin alterar su stock

### Requirement: La variante es la única posición de stock

El stock de un consumible SHALL vivir en su variante. Dos variantes distintas SHALL tener stock independiente. Un mismo material comprado a proveedores distintos SHALL corresponder a una sola variante y a un solo stock.

#### Scenario: Mismo material de varios proveedores

- **WHEN** una variante tiene códigos de tres proveedores distintos y se compran 100 unidades por cada uno
- **THEN** su `stock_actual` es 300, en una sola posición

#### Scenario: Variantes no intercambiables

- **WHEN** se retiran 50 unidades de la variante "6x40 zincado"
- **THEN** el stock de "8x60 inoxidable" no se modifica

### Requirement: Stock derivado para variantes prestables

El stock de una variante prestable SHALL calcularse como el conteo de sus unidades en estado Disponible (1) y NO SHALL almacenarse en columna. La respuesta de una variante prestable SHALL incluir `unidades_total` y `unidades_disponibles`.

#### Scenario: Herramienta parcialmente prestada

- **WHEN** una variante tiene 7 unidades y 4 están En Terreno
- **THEN** devuelve `unidades_total = 7` y `unidades_disponibles = 3`

#### Scenario: Unidad enviada a reparación

- **WHEN** una unidad Disponible pasa a estado En Reparación
- **THEN** `unidades_disponibles` baja en 1 sin que ninguna columna de stock se escriba

### Requirement: Alerta de stock mínimo unificada

Una variante SHALL considerarse bajo stock cuando su stock efectivo —`stock_actual` si es consumible, `unidades_disponibles` si es prestable— es menor o igual a `stock_minimo`. Un `stock_minimo` de cero SHALL desactivar la alerta.

#### Scenario: Consumible en el mínimo exacto

- **WHEN** `stock_actual` es igual a `stock_minimo`
- **THEN** la variante se considera bajo stock

#### Scenario: Herramienta bajo el mínimo de disponibles

- **WHEN** una variante prestable con `stock_minimo = 2` tiene 1 unidad disponible
- **THEN** la variante se considera bajo stock

#### Scenario: Variante sin mínimo configurado

- **WHEN** `stock_minimo` es 0
- **THEN** la variante nunca se reporta bajo stock

### Requirement: Atributos estructurados de variante

Una variante SHALL poder llevar atributos como pares clave-valor en `atributos` (JSONB), consultables por filtro. Los atributos SHALL ser opcionales y no reemplazan al nombre de la variante, que SHALL ser texto obligatorio escrito por el usuario.

#### Scenario: Filtro por atributo

- **WHEN** se listan variantes con `?atributo=material:zincado`
- **THEN** devuelve sólo las variantes cuyo JSONB contiene esa clave con ese valor

#### Scenario: Variante sin atributos

- **WHEN** se crea una variante sin declarar atributos
- **THEN** se guarda con `atributos` vacío y aparece normalmente en los listados

#### Scenario: Claves sugeridas por producto

- **WHEN** se solicitan las claves de atributo usadas en las variantes de un producto
- **THEN** devuelve la lista de claves distintas ya registradas, para ofrecerlas como autocompletado

### Requirement: Múltiples códigos por variante o unidad

El sistema SHALL permitir N códigos escaneables por variante y por unidad, en la tabla `codigos`. Cada código SHALL pertenecer a exactamente una variante o a exactamente una unidad, nunca a ambas ni a ninguna, y SHALL ser único dentro del tenant.

#### Scenario: Consumible con códigos de varios proveedores

- **WHEN** se registran tres códigos de proveedor distintos para la misma variante
- **THEN** los tres quedan asociados a ella y cualquiera de los tres la resuelve al escanearse

#### Scenario: Código duplicado en el tenant

- **WHEN** se registra un código ya usado por otra variante o unidad del mismo tenant
- **THEN** responde 409 con "El código '<codigo>' ya está registrado en otro item"

#### Scenario: Mismo código en tenants distintos

- **WHEN** dos tenants registran el mismo EAN de fábrica
- **THEN** ambos registros son válidos, porque la unicidad es por tenant

#### Scenario: Código sin dueño o con dos dueños

- **WHEN** se intenta crear un código sin `variante_id` ni `unidad_id`, o con ambos
- **THEN** responde 422 con "Un código pertenece a una variante o a una unidad, no a ambas"

#### Scenario: Herramienta con QR propio y serie de fábrica

- **WHEN** una unidad tiene un código `propio` y uno `serie_fabrica`
- **THEN** ambos resuelven a la misma unidad

### Requirement: Tipo y proveedor del código

Cada código SHALL declarar un `tipo` dentro de {`fabricante`, `proveedor`, `empaque`, `propio`, `serie_fabrica`} y SHALL poder referenciar un proveedor del catálogo del tenant.

El tipo SHALL determinar a qué nivel puede colgar el código, porque identifica al producto o al ejemplar:

- `fabricante`, `proveedor` y `empaque` identifican **qué es** y SHALL pertenecer a una variante.
- `serie_fabrica` identifica **cuál es** y SHALL pertenecer a una unidad.
- `propio` SHALL poder pertenecer a cualquiera de los dos: es el código que asigna el tenant, sea la etiqueta de un ejemplar o el código interno de un pozo de consumible.

#### Scenario: Tipo inválido

- **WHEN** se registra un código con un tipo fuera del set permitido
- **THEN** responde 422 listando los tipos válidos

#### Scenario: EAN del fabricante en una unidad

- **WHEN** se intenta registrar un código de tipo `fabricante` sobre una unidad
- **THEN** responde 422 con "Un código de fabricante identifica el modelo, no el ejemplar: debe colgar de la variante"

#### Scenario: Serie de fábrica en una variante

- **WHEN** se intenta registrar un código de tipo `serie_fabrica` sobre una variante
- **THEN** responde 422 con "Un número de serie identifica un ejemplar: debe colgar de la unidad"

#### Scenario: Varios ejemplares del mismo modelo

- **WHEN** una variante prestable tiene 3 unidades y el modelo trae un único EAN de fábrica
- **THEN** el EAN se registra una sola vez en la variante, y cada unidad lleva aparte su propio código `propio`

#### Scenario: Origen visible del código

- **WHEN** se listan los códigos de una variante
- **THEN** cada uno indica su tipo y el nombre de su proveedor cuando lo tiene

### Requirement: Factor de empaque en el código

Un código SHALL llevar un `factor` que expresa cuántas unidades de stock representa, con valor por defecto 1. Los códigos de tipo `empaque` SHALL poder declarar además un `nombre_empaque` de texto libre. El factor SHALL ser mayor a cero.

#### Scenario: Cajas de distinto contenido para la misma variante

- **WHEN** una variante tiene un código de empaque con factor 100 y otro con factor 250
- **THEN** ambos coexisten y cada uno conserva su propio contenido

#### Scenario: Factor no positivo

- **WHEN** se registra un código con factor menor o igual a cero
- **THEN** responde 422 con "El factor debe ser mayor a 0"

#### Scenario: Código de unidad suelta

- **WHEN** se registra un código sin declarar factor
- **THEN** se guarda con factor 1

### Requirement: Código principal por item

Cada variante y cada unidad SHALL tener a lo más un código marcado como principal, que es el que se muestra en listados y se imprime en etiquetas. El sistema SHALL marcar como principal el primer código de un item, y al eliminar el principal SHALL promover al más antiguo de los restantes.

#### Scenario: Primer código de un item

- **WHEN** se registra el primer código de una variante
- **THEN** queda marcado como principal automáticamente

#### Scenario: Eliminación del código principal

- **WHEN** se elimina el código principal de un item que tiene otros códigos
- **THEN** el más antiguo de los restantes pasa a ser principal

#### Scenario: Eliminación del único código de una unidad

- **WHEN** se elimina el único código de una unidad
- **THEN** responde 409 con "Una unidad debe conservar al menos un código"

#### Scenario: Cambio manual de principal

- **WHEN** se marca como principal un código que no lo era
- **THEN** el anterior deja de serlo en la misma operación

### Requirement: Alta de unidades por cantidad

`POST /api/v1/variantes/{variante_id}/unidades` SHALL crear N unidades en una sola operación, cada una con un código principal autogenerado en formato `EFG-XXXXXXXX`, en estado Disponible (1) y con la ubicación indicada.

#### Scenario: Recepción de diez herramientas iguales

- **WHEN** se solicitan 10 unidades para una variante prestable
- **THEN** se crean 10 unidades, cada una con su código único autogenerado, y la respuesta las devuelve para imprimir sus etiquetas

#### Scenario: Cantidad no positiva

- **WHEN** la cantidad es menor o igual a cero
- **THEN** responde 400 con "La cantidad debe ser mayor a 0"

#### Scenario: Código de fábrica agregado después

- **WHEN** se agrega un código `serie_fabrica` a una unidad ya creada
- **THEN** convive con el autogenerado, que sigue siendo el principal

### Requirement: Catálogo de proveedores por tenant

El tenant SHALL poder mantener proveedores propios con nombre obligatorio, y RUT y contacto opcionales. Un proveedor SHALL poder eliminarse sólo si ningún código lo referencia. Los movimientos de compra que lo referencian NO SHALL bloquear la eliminación: conservan su cantidad y su costo, y su `proveedor_id` queda nulo.

Un proveedor SHALL poder crearse implícitamente por nombre desde la importación Excel, con el mismo criterio que `familia` y `ubicacion`.

#### Scenario: Proveedor en uso

- **WHEN** se elimina un proveedor referenciado por N códigos
- **THEN** responde 409 con "No se puede eliminar: el proveedor tiene N código(s) asociado(s)"

#### Scenario: Proveedor sin nombre

- **WHEN** se crea un proveedor con nombre vacío
- **THEN** responde 422 con "El nombre del proveedor es obligatorio"

#### Scenario: Proveedor con historial de compras

- **WHEN** se elimina un proveedor sin códigos pero con compras registradas
- **THEN** la eliminación procede y los logs conservan su cantidad y costo con `proveedor_id` nulo

#### Scenario: Proveedores conocidos de una variante

- **WHEN** se consultan los proveedores de una variante
- **THEN** devuelve los proveedores distintos referenciados por sus códigos, para ofrecerlos en el formulario de compra

### Requirement: Ubicación con precedencia de unidad sobre variante

La ubicación efectiva de un item SHALL resolverse con precedencia: la ubicación de la unidad si está definida, si no la de su variante, y si ambas son nulas el item no tiene ubicación asignada.

#### Scenario: Herramienta con ubicación propia

- **WHEN** una unidad tiene ubicación y su variante tiene otra distinta
- **THEN** la ubicación efectiva de esa unidad es la suya

#### Scenario: Herramienta sin ubicación propia

- **WHEN** una unidad no tiene ubicación y su variante sí
- **THEN** la ubicación efectiva de esa unidad es la de la variante

#### Scenario: Consumible

- **WHEN** se consulta la ubicación de una variante consumible
- **THEN** se usa la de la variante, porque no tiene unidades

### Requirement: Edición de producto y variante

El sistema SHALL permitir corregir el catálogo desde la interfaz: nombre, descripción, marca y familia de un producto; nombre, atributos, unidad, stock mínimo, precio de compra, valor de reposición, días de préstamo y ubicación de una variante.

La carga masiva es para el arranque; de ahí en adelante el catálogo se mantiene desde la interfaz. Sin edición, la única salida para arreglar una letra es reimportar una planilla, y en la práctica termina con nombres mal escritos que nadie arregla.

#### Scenario: Renombrar sin perder historia

- **WHEN** se renombra una variante que ya tiene movimientos
- **THEN** el cambio se aplica y la bitácora sigue completa, porque los movimientos referencian el identificador de la variante y no su nombre

#### Scenario: Nombre repetido dentro del producto

- **WHEN** se renombra una variante con el nombre de otra del mismo producto
- **THEN** responde 409 con "El producto ya tiene una variante '<nombre>'"

#### Scenario: Cambio de precio

- **WHEN** se corrige el precio de compra de una variante
- **THEN** los movimientos ya registrados conservan su costo congelado, y sólo los nuevos usan el precio corregido

### Requirement: El stock no se edita, se mueve

La edición de una variante NO SHALL exponer `stock_actual`. Corregir existencias SHALL hacerse mediante un movimiento —compra, ajuste, merma— que quede en la bitácora.

Un campo de stock editable permite que las existencias cambien sin dejar rastro, y es exactamente la puerta que la bitácora existe para cerrar: si el stock puede saltar de 500 a 300 sin un movimiento que lo explique, la trazabilidad es decorativa.

#### Scenario: Intento de editar el stock

- **WHEN** la petición de edición incluye `stock_actual`
- **THEN** el campo se ignora y el stock queda intacto

#### Scenario: Corrección tras un conteo físico

- **WHEN** el conteo arroja 480 donde el sistema dice 500
- **THEN** la corrección se hace con un ajuste que registra la diferencia y su motivo, no editando la variante

### Requirement: Cambios que el inventario existente bloquea

Un cambio SHALL rechazarse cuando reinterpretaría en silencio inventario ya registrado:

- Cambiar la familia de un producto a `consumible` SHALL bloquearse si alguna de sus variantes tiene unidades.
- Cambiar la familia de un producto a `prestable` SHALL bloquearse si alguna de sus variantes tiene stock distinto de cero.
- Cambiar la unidad de medida de una variante SHALL bloquearse si tiene stock distinto de cero.

#### Scenario: Consumible que pasa a prestable con stock

- **WHEN** se cambia a `prestable` la familia de un producto cuya variante tiene 500 unidades de stock
- **THEN** responde 409 explicando que hay stock que dejaría de tener sentido, porque el stock de un prestable se deriva de sus ejemplares

#### Scenario: Cambio de unidad de medida con existencias

- **WHEN** se cambia la unidad de `unidad` a `metro` en una variante con 500 en stock
- **THEN** responde 409: convertir 500 unidades en 500 metros no es un cambio de etiqueta, es afirmar algo distinto sobre lo que hay en la repisa

#### Scenario: Cambio de unidad sin existencias

- **WHEN** la variante tiene stock cero
- **THEN** el cambio se acepta, porque no hay cantidad que reinterpretar

### Requirement: Eliminación validada por nivel

La eliminación SHALL validarse en el nivel que corresponde: una unidad no SHALL eliminarse con préstamo abierto, una variante no SHALL eliminarse con unidades ni con stock distinto de cero, y un producto no SHALL eliminarse con más de una variante.

Además, un item con **movimientos registrados** NO SHALL eliminarse en ningún nivel. Borrar deja la bitácora hablando de algo que ya no existe, y el historial de bodega es el activo que este sistema construye: una herramienta que se perdió dos veces tiene que seguir contándolo aunque hoy nadie la use. Lo que se carga por error y nunca se movió sí se borra.

#### Scenario: Variante con movimientos

- **WHEN** se elimina una variante que registró compras, entregas o mermas
- **THEN** responde 409 con "No se puede eliminar: tiene N movimiento(s) en la bitácora"

#### Scenario: Item cargado por error

- **WHEN** se elimina una variante recién creada, sin stock, sin unidades y sin movimientos
- **THEN** se elimina junto con sus códigos

#### Scenario: Unidad con préstamo abierto

- **WHEN** se elimina una unidad con un préstamo sin `fecha_devolucion_real`
- **THEN** responde 409 con "No se puede eliminar: la unidad tiene un préstamo activo"

#### Scenario: Variante con stock

- **WHEN** se elimina una variante con `stock_actual` distinto de cero
- **THEN** responde 409 con "No se puede eliminar: la variante tiene stock. Ajuste el stock a 0 primero"

#### Scenario: Variante con unidades

- **WHEN** se elimina una variante que tiene unidades
- **THEN** responde 409 con "No se puede eliminar: la variante tiene N unidad(es)"

#### Scenario: Eliminación en cascada de los códigos

- **WHEN** se elimina una variante o unidad sin bloqueos
- **THEN** sus códigos se eliminan con ella
