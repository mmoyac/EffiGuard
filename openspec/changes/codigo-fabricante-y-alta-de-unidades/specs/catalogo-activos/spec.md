## ADDED Requirements

### Requirement: Código de fabricante del activo

Todo activo SHALL poder registrar el código de barras que trae de fábrica (EAN/UPC/GTIN) en el campo opcional `codigo_fabricante`. El campo identifica al producto, no a la unidad, por lo que varias unidades del mismo producto lo comparten y no es único.

#### Scenario: Tres unidades del mismo producto

- **WHEN** se cargan tres atornilladores del mismo modelo con el mismo código de fabricante
- **THEN** las tres quedan registradas con ese código y cada una conserva su `uid_fisico` propio

#### Scenario: Consulta del código de fábrica

- **WHEN** se consulta o escanea un activo que tiene código de fabricante
- **THEN** el código se muestra junto al UID, distinguiéndolo claramente de él

#### Scenario: Activo sin código de fabricante

- **WHEN** el activo no lo tiene registrado
- **THEN** el campo viene nulo y no se muestra bloque alguno

#### Scenario: Consumible identificado por su EAN

- **WHEN** un consumible se carga usando el EAN del fabricante como `uid_fisico`
- **THEN** el escaneo de la caja lo resuelve directamente, sin necesidad de imprimir una etiqueta propia

### Requirement: Alta de unidades clonando un producto conocido

El sistema SHALL permitir crear una o varias unidades nuevas a partir de un código de fabricante ya presente en el tenant, copiando de la unidad más reciente con ese código su nombre, familia, modelo, valor de reposición, días máximos de préstamo, unidad de medida y el propio código. Cada unidad creada recibe un `uid_fisico` autogenerado y queda en estado Disponible.

#### Scenario: Llega una herramienta nueva de un producto ya conocido

- **WHEN** el bodeguero escanea el código de fábrica de un atornillador del que ya existen tres unidades y pide crear una
- **THEN** se crea una cuarta unidad con los mismos atributos, con UID nuevo y estado Disponible, lista para imprimir su etiqueta

#### Scenario: Compra de varias unidades iguales

- **WHEN** se solicita crear 5 unidades a partir del código
- **THEN** se crean 5 activos independientes, cada uno con su propio UID

#### Scenario: La ubicación no se hereda

- **WHEN** se crean unidades clonando un producto cuya unidad de referencia tiene ubicación asignada
- **THEN** las unidades nuevas quedan sin ubicación, porque todavía no han sido guardadas en bodega

#### Scenario: Código desconocido

- **WHEN** el código de fabricante no corresponde a ninguna unidad existente del tenant
- **THEN** responde 404 y el bodeguero continúa por el alta manual, pudiendo registrar el código para futuras altas

#### Scenario: Confirmación antes de crear

- **WHEN** el sistema identifica el producto a clonar
- **THEN** la interfaz muestra de qué producto se trata y cuántas unidades existen antes de confirmar la creación

## MODIFIED Requirements

### Requirement: Activo identificado por UID físico único

Cada activo SHALL tener un `uid_fisico` único **dentro de su tenant**, correspondiente a su código QR, tag RFID o al código de barras del fabricante cuando se trate de un consumible. Dos tenants distintos pueden usar el mismo código sin interferirse.

#### Scenario: Alta con UID ya existente en el mismo tenant

- **WHEN** se intenta crear un activo con un `uid_fisico` ya registrado en el tenant
- **THEN** responde 409 con "Ya existe un activo con el código '<uid>'"

#### Scenario: Mismo código en dos tenants distintos

- **WHEN** dos clientes cargan el mismo EAN de fabricante como UID de su consumible
- **THEN** ambos activos coexisten y cada tenant resuelve el suyo al escanear

#### Scenario: Importación de un UID usado por otro tenant

- **WHEN** un archivo Excel trae un `uid_fisico` que ya existe en otro tenant
- **THEN** la fila se procesa normalmente, sin el rechazo por colisión cross-tenant que aplicaba antes

### Requirement: Importación masiva desde Excel

El sistema SHALL permitir crear y actualizar activos desde un archivo `.xlsx` con las columnas `uid_fisico`, `nombre`, `familia`, `estado`, `stock_actual`, `stock_minimo`, `valor_reposicion`, `dias_max_prestamo`, `proxima_mantencion`, `ubicacion_rack`, `ubicacion_nivel`, `ubicacion_posicion`, `unidad` y `codigo_fabricante`, usando `uid_fisico` como clave de upsert. Las columnas nuevas se agregan al final del orden existente, que no se altera.

#### Scenario: Archivo generado con un template anterior

- **WHEN** se importa un archivo sin la columna de código de fabricante
- **THEN** las filas se procesan normalmente y el código queda sin asignar

#### Scenario: Carga masiva de códigos de fábrica

- **WHEN** se importa un archivo con `codigo_fabricante` en filas de activos ya existentes
- **THEN** cada activo queda actualizado con su código, sin exigir que sea único entre filas

#### Scenario: Fila sin uid_fisico

- **WHEN** una fila viene con `uid_fisico` vacío
- **THEN** se crea un activo nuevo con un UID autogenerado con formato `EFG-XXXXXXXX`

#### Scenario: UID existente del mismo tenant

- **WHEN** el `uid_fisico` ya pertenece a un activo del tenant
- **THEN** el activo se actualiza con los valores de la fila

#### Scenario: Validación previa sin escribir

- **WHEN** se importa con `dry_run=true`
- **THEN** devuelve el conteo de filas válidas para crear y actualizar más la lista de errores por fila, sin modificar la base de datos

#### Scenario: Errores de datos por fila

- **WHEN** una fila omite `nombre` o `familia`, referencia una familia inexistente, un estado inválido, una unidad no soportada, una ubicación incompleta o un número/fecha mal formados
- **THEN** se acumula un error con el número de fila y el motivo, y esa fila se omite

#### Scenario: Cantidades decimales en el archivo

- **WHEN** una fila trae `stock_actual` con decimales, con coma o con punto como separador
- **THEN** el valor se interpreta con hasta tres decimales

#### Scenario: Ubicación existente en el catálogo

- **WHEN** una fila trae una terna rack/nivel/posición que ya existe en el catálogo del tenant
- **THEN** el activo se asigna a esa ubicación, sin duplicarla

#### Scenario: Ubicación que no existe todavía

- **WHEN** una fila trae una terna rack/nivel/posición que no está en el catálogo
- **THEN** la ubicación se crea y el activo se asigna a ella, en lugar de rechazar la fila

#### Scenario: Reporte de ubicaciones creadas

- **WHEN** una importación crea ubicaciones nuevas
- **THEN** la respuesta informa cuántas se crearon, para que un error de tipeo masivo en el archivo sea visible

#### Scenario: Descarga del template

- **WHEN** el tenant ya tiene activos y solicita el template
- **THEN** recibe un Excel con sus activos raíz precargados —incluidos ubicación, unidad y código de fabricante— para editar y reimportar; si no tiene activos, recibe el template vacío con filas de ejemplo
