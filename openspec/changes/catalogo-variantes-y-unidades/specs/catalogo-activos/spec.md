## MODIFIED Requirements

### Requirement: Comportamiento derivado de la familia

El comportamiento operativo SHALL determinarse por la familia (`asset_families.comportamiento`), con dos valores válidos: `prestable` (requiere préstamo y devolución) y `consumible` (sólo descuenta stock). La familia SHALL asignarse al **producto**, y sus variantes y unidades SHALL heredarla. Ningún nivel de la jerarquía declara su tipo directamente.

#### Scenario: Creación de familia con comportamiento inválido

- **WHEN** se crea una familia con un `comportamiento` distinto de `prestable` o `consumible`
- **THEN** responde 422 con "comportamiento debe ser 'prestable' o 'consumible'"

#### Scenario: Familia con color fuera del set permitido

- **WHEN** se crea una familia con un color fuera de {blue, orange, green, purple, red, yellow, pink, cyan}
- **THEN** responde 422 listando las opciones válidas

#### Scenario: Familias por defecto de un tenant nuevo

- **WHEN** el Super Admin crea un tenant
- **THEN** se siembran dos familias: "Herramienta" (prestable, blue) y "Consumible" (consumible, orange)

#### Scenario: Herencia hacia variantes y unidades

- **WHEN** se consulta una variante o una unidad
- **THEN** la respuesta incluye el comportamiento y el color de la familia de su producto

#### Scenario: Cambio de familia con unidades existentes

- **WHEN** se cambia la familia de un producto de `prestable` a `consumible` y alguna de sus variantes tiene unidades
- **THEN** responde 409 con "No se puede cambiar a consumible: el producto tiene N unidad(es)"

### Requirement: Familia no eliminable con activos asignados

Una familia SHALL poder eliminarse sólo si ningún **producto** la referencia.

#### Scenario: Intento de borrar familia en uso

- **WHEN** se elimina una familia con N productos asignados
- **THEN** responde 409 con "No se puede eliminar: la familia tiene N producto(s) asignado(s)"

### Requirement: Estados de activo

Toda **unidad** SHALL tener un estado del catálogo global, con IDs estables usados por la lógica de negocio: 1 Disponible, 2 En Terreno, 3 En Reparación, 4 Robado. Las variantes consumibles NO SHALL tener estado: su condición operativa es su stock.

#### Scenario: Unidad en estado no operable

- **WHEN** se escanea una unidad cuyo estado no es Disponible, En Terreno ni En Reparación
- **THEN** la interfaz muestra "No disponible para operar" y no ofrece acción principal

#### Scenario: Consumible sin estado

- **WHEN** se consulta una variante consumible
- **THEN** la respuesta no incluye estado y la interfaz muestra su stock en ese lugar

### Requirement: Kits padre-hijo

Una **unidad** SHALL poder tener hijas mediante `parent_unidad_id`, formando un kit. La unidad padre es la que tiene `parent_unidad_id IS NULL` y unidades hijas vinculadas. Las variantes consumibles NO SHALL participar en kits.

#### Scenario: Consulta de una unidad padre

- **WHEN** se obtiene una unidad raíz
- **THEN** la respuesta incluye la colección de sus unidades hijas

#### Scenario: Intento de armar un kit con un consumible

- **WHEN** se asigna como hija de un kit una variante consumible
- **THEN** responde 400 con "Sólo las unidades prestables pueden formar kits"

### Requirement: Límite de días de préstamo con herencia

El límite de días de préstamo SHALL resolverse con precedencia: `variantes.dias_max_prestamo` si está definido, si no `asset_families.dias_max_prestamo` de la familia de su producto, y si ambos son nulos la unidad no tiene límite.

#### Scenario: Variante sin límite propio

- **WHEN** la variante tiene `dias_max_prestamo = NULL` y su familia define 7 días
- **THEN** el límite efectivo de sus unidades es 7 días

#### Scenario: Variante y familia sin límite

- **WHEN** ambos valores son nulos
- **THEN** los préstamos de esas unidades nunca se reportan como vencidos

### Requirement: Catálogo de marcas y modelos

El tenant SHALL poder mantener marcas propias (`brands`), referenciables de forma opcional desde un producto. El concepto de "modelo" SHALL corresponder al producto: un producto de familia prestable *es* un modelo de herramienta.

#### Scenario: Listado de productos por marca

- **WHEN** se consulta `GET /api/v1/catalog/productos?brand_id=N`
- **THEN** devuelve sólo los productos de esa marca dentro del tenant

#### Scenario: Producto sin marca

- **WHEN** se crea un consumible sin declarar marca
- **THEN** el producto se crea con `brand_id` nulo y aparece normalmente en los listados

### Requirement: Importación masiva desde Excel

El sistema SHALL permitir crear y actualizar catálogo desde un archivo `.xlsx` con las columnas `producto`, `variante`, `familia`, `marca`, `unidad`, `stock_actual`, `stock_minimo`, `precio_compra`, `valor_reposicion`, `dias_max_prestamo`, `codigos`, `cantidad_unidades` y `ubicacion`.

La columna `codigos` acepta una lista separada por `;`, cada entrada con formato `codigo[:tipo[:factor[:proveedor]]]`. El proveedor se referencia por nombre y SHALL crearse en el catálogo del tenant si no existe, con el mismo criterio que `familia` y `ubicacion`.

El **tipo de cada código SHALL determinar a qué nivel se asocia**, sin necesidad de una columna aparte: `fabricante`, `proveedor` y `empaque` cuelgan de la variante; `serie_fabrica` y, en filas prestables, `propio`, cuelgan de la unidad que crea la fila.

La clave de upsert SHALL depender del comportamiento: el par (`producto`, `variante`) para filas consumibles, y la terna (`producto`, `variante`, primer código **de nivel unidad**) para filas prestables que declaran códigos de ese nivel, de modo que cada fila represente un ejemplar.

#### Scenario: Fila sin variante

- **WHEN** una fila trae `producto` pero deja `variante` vacía
- **THEN** se crea el producto con una variante homónima, igual que en el alta por formulario

#### Scenario: Par producto-variante existente

- **WHEN** el par (`producto`, `variante`) de una fila consumible ya existe en el tenant
- **THEN** la variante se actualiza con los valores de la fila y sus códigos se agregan sin borrar los previos

#### Scenario: Varias filas del mismo producto

- **WHEN** tres filas comparten `producto` y difieren en `variante`
- **THEN** se crea un solo producto con tres variantes

#### Scenario: Código con proveedor

- **WHEN** una fila declara `7801234567890:proveedor:1:Sodimac` y el tenant no tiene ese proveedor
- **THEN** se crea el proveedor "Sodimac" y el código queda asociado a él

#### Scenario: Código ya usado por otro item

- **WHEN** una fila declara un código que ya pertenece a otra variante o unidad del tenant
- **THEN** la fila se rechaza con "el código '<codigo>' ya está registrado en otro item" y el resto del archivo continúa procesándose

#### Scenario: Alta de ejemplares por cantidad

- **WHEN** una fila de familia prestable declara `cantidad_unidades = 200` y crea la variante
- **THEN** se crean 200 unidades en estado Disponible con código principal autogenerado

#### Scenario: Alta por cantidad con EAN del modelo

- **WHEN** una fila prestable declara `cantidad_unidades = 3` y un código de tipo `fabricante`
- **THEN** el EAN se registra una vez en la variante y se crean las 3 unidades con su código autogenerado, porque los dos datos viven en niveles distintos y no se contradicen

#### Scenario: Alta de ejemplares ya etiquetados

- **WHEN** varias filas comparten `producto` y `variante` de familia prestable y cada una declara un código `propio` distinto
- **THEN** cada fila crea una unidad con ese código como principal, bajo una única variante

#### Scenario: EAN del modelo repetido en varias filas

- **WHEN** tres filas del mismo modelo declaran el mismo código de tipo `fabricante`
- **THEN** el código se registra una sola vez en la variante y las repeticiones se ignoran sin error, porque apuntan al item que ya lo tiene

#### Scenario: Cantidad y códigos de unidad a la vez

- **WHEN** una fila prestable declara `cantidad_unidades` junto con un código de nivel unidad (`propio` o `serie_fabrica`)
- **THEN** la fila se rechaza con "Declare cantidad_unidades o los códigos del ejemplar, no ambos"

#### Scenario: Cantidad de unidades sobre una variante existente

- **WHEN** una fila declara `cantidad_unidades` y su variante ya existe
- **THEN** la columna se ignora, se informa como advertencia y las unidades no se duplican

#### Scenario: Cantidad de unidades en una fila consumible

- **WHEN** una fila de familia consumible declara `cantidad_unidades`
- **THEN** la fila se rechaza con "cantidad_unidades sólo aplica a familias prestables"

#### Scenario: Validación previa sin escribir

- **WHEN** se importa con `dry_run=true`
- **THEN** devuelve el conteo de productos, variantes y unidades a crear y actualizar, los ajustes de stock que se aplicarían y la lista de errores y advertencias por fila, sin modificar la base de datos

#### Scenario: Errores de datos por fila

- **WHEN** una fila omite `producto` o `familia`, referencia una familia inexistente, una ubicación inexistente o un número mal formado
- **THEN** se acumula un error con el número de fila y el motivo, y esa fila se omite

#### Scenario: Descarga del template

- **WHEN** el tenant ya tiene catálogo y solicita el template
- **THEN** recibe un Excel con una fila por variante existente, con `stock_actual` y `cantidad_unidades` **vacías**, para editar y reimportar sin riesgo de pisar inventario; si no tiene catálogo, recibe el template vacío con filas de ejemplo

### Requirement: Listado y consulta de activos

El sistema SHALL exponer listado paginado de **variantes** con filtro opcional por comportamiento, producto y atributo; consulta de una variante por ID con sus códigos y sus unidades; y listado de variantes bajo stock mínimo.

#### Scenario: Filtro por comportamiento

- **WHEN** se lista con `?comportamiento=consumible`
- **THEN** devuelve sólo variantes cuyo producto pertenece a una familia con ese comportamiento

#### Scenario: Consulta de bajo stock

- **WHEN** se consulta `GET /api/v1/variantes/low-stock`
- **THEN** devuelve las variantes cuyo stock efectivo es menor o igual a su `stock_minimo`, excluyendo las que tienen `stock_minimo` en 0

#### Scenario: Detalle de una variante prestable

- **WHEN** se consulta una variante de familia prestable
- **THEN** la respuesta incluye sus códigos, sus unidades con estado y ubicación, y los conteos total y disponible

## ADDED Requirements

### Requirement: Celda vacía en la importación nunca borra

Una celda vacía en una fila que **actualiza** un item existente SHALL dejar el valor vigente intacto. Ninguna columna de la importación SHALL interpretarse como orden de borrado. Borrar un valor SHALL hacerse desde la interfaz, no dejando una celda en blanco.

#### Scenario: Reimportación parcial

- **WHEN** se reimporta una planilla con sólo las columnas `producto`, `variante` y `precio_compra`
- **THEN** se actualiza el precio y se conservan marca, unidad, mínimos, ubicación, códigos y stock

#### Scenario: Celda vaciada a propósito

- **WHEN** una fila deja `dias_max_prestamo` vacío sobre una variante que tenía 7
- **THEN** la variante conserva sus 7 días, y el cambio a "sin límite" se hace desde la interfaz

#### Scenario: Alta con celdas vacías

- **WHEN** una fila **crea** una variante dejando columnas opcionales vacías
- **THEN** esas columnas quedan nulas, porque no hay valor previo que conservar

### Requirement: La importación nunca escribe stock en silencio

La importación NO SHALL escribir `stock_actual` directamente sobre una variante existente. Un `stock_actual` declarado SHALL traducirse siempre en un movimiento registrado en `inventory_logs`: un log de apertura al crear la variante, y un `ajuste` cuando difiere del stock vigente. Una celda vacía SHALL dejar el stock intacto.

#### Scenario: Saldo de apertura

- **WHEN** una fila crea una variante consumible con `stock_actual = 500`
- **THEN** la variante queda con 500 y se registra un log tipo `ajuste` con la observación "Saldo de apertura: importación Excel", para que la bitácora arranque cuadrada

#### Scenario: Reimportación con stock distinto al vigente

- **WHEN** una fila actualiza una variante cuyo stock vigente es 1170 y declara `stock_actual = 1200`
- **THEN** el stock queda en 1200 y se registra un log tipo `ajuste` con la observación "Ajuste: 1170 → 1200, importación Excel"

#### Scenario: Reimportación sin tocar el stock

- **WHEN** una fila actualiza una variante y deja `stock_actual` vacío
- **THEN** el stock no se modifica y no se genera ningún movimiento

#### Scenario: Stock declarado sobre una variante prestable

- **WHEN** una fila de familia prestable declara `stock_actual`
- **THEN** la columna se ignora, porque el stock de una herramienta se deriva de sus unidades

## REMOVED Requirements

### Requirement: Activo identificado por UID físico único

**Reason**: El identificador escaneable deja de ser una columna del activo y pasa a ser una fila de `codigos`, para que un mismo item pueda tener varios códigos —el propio, el de cada proveedor y el del empaque—. Un `uid_fisico` escalar es justamente lo que impedía resolver el caso de los proveedores múltiples.

**Migration**: Lo cubre "Múltiples códigos por variante o unidad" y "Código principal por item" en `productos-y-variantes`. La unicidad por tenant se conserva, ahora sobre `UNIQUE (tenant_id, codigo)` en una sola tabla que abarca variantes y unidades. El código principal de una unidad cumple el rol que tenía `uid_fisico` en listados y etiquetas.

### Requirement: Eliminación de activo bloqueada por préstamo activo

**Reason**: Con tres niveles, la regla de borrado ya no es una sola: una unidad se bloquea por préstamo abierto, una variante por tener stock o unidades, y un producto por quedarse sin variantes. Una única regla sobre "activo" no puede expresar las tres.

**Migration**: Lo cubre "Eliminación validada por nivel" en `productos-y-variantes`, que conserva el bloqueo por préstamo abierto en el nivel donde ahora vive el préstamo —la unidad— y agrega los bloqueos de los otros dos niveles.
