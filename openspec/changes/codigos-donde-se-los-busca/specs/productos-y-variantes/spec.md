## MODIFIED Requirements

### Requirement: Tipo y proveedor del código

Cada código SHALL declarar un `tipo` dentro de {`fabricante`, `proveedor`, `empaque`, `propio`, `serie_fabrica`}.

El tipo SHALL determinar a qué nivel puede colgar el código, porque identifica al producto o al ejemplar:

- `fabricante`, `proveedor` y `empaque` identifican **qué es** y SHALL pertenecer a una variante.
- `serie_fabrica` identifica **cuál es** y SHALL pertenecer a una unidad.
- `propio` SHALL poder pertenecer a cualquiera de los dos: es el código que asigna el tenant, sea la etiqueta de un ejemplar o el código interno de un pozo de consumible.

El tipo SHALL determinar además si el código puede referenciar un proveedor. Sólo `proveedor` y `empaque` describen un origen comercial y SHALL poder llevarlo. Un `fabricante` viene impreso de fábrica y es el mismo para todos los que lo venden; un `propio` lo asigna el tenant. Atarles un proveedor afirma lo contrario de lo que son, y la interfaz NO SHALL ofrecer el campo en esos tipos.

#### Scenario: Tipo inválido

- **WHEN** se registra un código con un tipo fuera del set permitido
- **THEN** responde 422 listando los tipos válidos

#### Scenario: EAN del fabricante en una unidad

- **WHEN** se intenta registrar un código de tipo `fabricante` sobre una unidad
- **THEN** responde 422 con "Un código de fabricante identifica el modelo, no el ejemplar: debe colgar de la variante"

#### Scenario: Serie de fábrica en una variante

- **WHEN** se intenta registrar un código de tipo `serie_fabrica` sobre una variante
- **THEN** responde 422 con "Un número de serie identifica un ejemplar: debe colgar de la unidad"

#### Scenario: Proveedor ofrecido según el tipo

- **WHEN** el usuario elige el tipo de un código en el formulario de alta
- **THEN** el campo de proveedor aparece para `proveedor` y `empaque`, y desaparece para `fabricante` y `propio`

#### Scenario: Cambio de tipo con un proveedor ya elegido

- **WHEN** el usuario elige un proveedor y luego cambia el tipo a uno que no lo admite
- **THEN** el proveedor se descarta y no se envía, para que no quede un dato que la interfaz dejó de mostrar

#### Scenario: Varios ejemplares del mismo modelo

- **WHEN** una variante prestable tiene 3 unidades y el modelo trae un único EAN de fábrica
- **THEN** el EAN se registra una sola vez en la variante, y cada unidad lleva aparte su propio código `propio`

#### Scenario: Origen visible del código

- **WHEN** se listan los códigos de una variante
- **THEN** cada uno indica su tipo y el nombre de su proveedor cuando lo tiene

### Requirement: Edición de producto y variante

El sistema SHALL permitir corregir el catálogo desde la interfaz: nombre, descripción, marca y familia de un producto; nombre, atributos, unidad, stock mínimo, precio de compra, valor de reposición, días de préstamo y ubicación de una variante.

La edición de una variante SHALL dar acceso a la administración de sus códigos —listarlos, agregar, marcar el principal y eliminar—. Es donde el usuario los busca: el botón dice editar la variante, y los códigos son parte de la variante.

La carga masiva es para el arranque; de ahí en adelante el catálogo se mantiene desde la interfaz. Sin edición, la única salida para arreglar una letra es reimportar una planilla, y en la práctica termina con nombres mal escritos que nadie arregla.

#### Scenario: Corregir un código desde la edición de la variante

- **WHEN** el usuario abre la edición de una variante para cambiar uno de sus códigos
- **THEN** encuentra ahí la lista de códigos con sus acciones, sin tener que cerrar el modal ni buscar en otra parte de la pantalla

#### Scenario: Renombrar sin perder historia

- **WHEN** se renombra una variante que ya tiene movimientos
- **THEN** el cambio se aplica y la bitácora sigue completa, porque los movimientos referencian el identificador de la variante y no su nombre

#### Scenario: Nombre repetido dentro del producto

- **WHEN** se renombra una variante con el nombre de otra del mismo producto
- **THEN** responde 409 con "El producto ya tiene una variante '<nombre>'"

#### Scenario: Cambio de precio

- **WHEN** se corrige el precio de compra de una variante
- **THEN** los movimientos ya registrados conservan su costo congelado, y sólo los nuevos usan el precio corregido
