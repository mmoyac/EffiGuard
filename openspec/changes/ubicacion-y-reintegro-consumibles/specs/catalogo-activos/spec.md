## ADDED Requirements

### Requirement: Catálogo de ubicaciones de bodega

El tenant SHALL mantener un catálogo de ubicaciones donde cada registro representa una posición física real: rack, nivel y posición, más una descripción opcional. La combinación de los tres campos es única dentro del tenant y se almacena sin espacios extremos y en mayúsculas.

#### Scenario: Alta de una posición

- **WHEN** se crea la ubicación rack "3", nivel "5", posición "11"
- **THEN** queda disponible para asignarse a cualquier activo del tenant

#### Scenario: Rack alfanumérico

- **WHEN** la bodega rotula sus racks como "A", "B1" o "PASILLO-2"
- **THEN** el valor se acepta tal cual, sin exigir que sea numérico

#### Scenario: Normalización al guardar

- **WHEN** se ingresa el rack como " a1 "
- **THEN** se almacena como "A1"

#### Scenario: Ubicación duplicada

- **WHEN** se intenta crear una ubicación cuya terna rack/nivel/posición ya existe en el tenant
- **THEN** responde 409 y se ofrece la ubicación existente en lugar de crear una segunda

#### Scenario: Renombrar un rack completo

- **WHEN** se actualiza el rack de una ubicación del catálogo
- **THEN** todos los activos asignados a ella quedan reubicados sin tocarlos uno por uno

#### Scenario: Eliminación de una ubicación en uso

- **WHEN** se intenta eliminar una ubicación que tiene N activos asignados
- **THEN** responde 409 indicando la cantidad de activos que la ocupan

### Requirement: Asignación de ubicación al activo

Todo activo SHALL poder apuntar a una ubicación del catálogo mediante `ubicacion_id` opcional. La selección se hace con listas en cascada derivadas del catálogo: rack, luego los niveles de ese rack, luego las posiciones de ese nivel.

#### Scenario: Bodeguero ubica una caja de tornillos

- **WHEN** el bodeguero asigna a un consumible la ubicación rack "3", nivel "5", posición "11"
- **THEN** el activo se muestra como "Rack 3 · Nivel 5 · Pos 11" en el listado, en la edición y en el resultado del escaneo

#### Scenario: Selección en cascada

- **WHEN** el bodeguero elige el rack "3"
- **THEN** el selector de nivel ofrece sólo los niveles existentes en ese rack, y el de posición sólo las posiciones de ese nivel

#### Scenario: Creación de la ubicación sin salir del formulario

- **WHEN** la posición donde está guardando el activo todavía no existe en el catálogo
- **THEN** puede crearla desde el mismo formulario del activo, y queda creada y seleccionada sin navegar a otra pantalla

#### Scenario: Activo sin ubicación asignada

- **WHEN** un activo tiene `ubicacion_id` nulo
- **THEN** la interfaz omite el bloque de ubicación en lugar de mostrarlo vacío

### Requirement: Unidad de medida del activo

Todo activo SHALL declarar su unidad de medida con uno de los valores `unidad`, `metro`, `kilo` o `litro`, con `unidad` por defecto. La unidad acompaña al stock en toda presentación de cantidades.

#### Scenario: Consumible medido en metros

- **WHEN** un consumible tiene `unidad = "metro"` y stock 80,5
- **THEN** la interfaz muestra "80,5 m" en lugar de "80,5"

#### Scenario: Valor de unidad no soportado

- **WHEN** se intenta guardar una unidad fuera del set permitido
- **THEN** responde 422 indicando las opciones válidas

#### Scenario: Activo existente sin unidad declarada

- **WHEN** se consulta un activo creado antes de este cambio
- **THEN** su unidad es `unidad`

### Requirement: Stock con precisión decimal

`stock_actual` y `stock_minimo` SHALL admitir hasta tres decimales, para representar medidas continuas como metros, kilos o litros. Las cantidades se manejan con aritmética decimal exacta y se exponen en la API como número JSON, no como texto.

#### Scenario: Registro de una medida fraccionaria

- **WHEN** un consumible queda con 12,5 metros de stock
- **THEN** el valor se almacena y se devuelve como 12.5, sin redondearse a entero

#### Scenario: Comparación de bajo stock con decimales

- **WHEN** el stock es 20,000 y el mínimo es 20,000
- **THEN** el activo se considera bajo stock, igual que con valores enteros

### Requirement: Filtro de activos por ubicación

El listado de activos SHALL poder filtrarse por rack o por ubicación exacta, para responder "qué hay guardado en el rack 3".

#### Scenario: Consulta por rack

- **WHEN** se lista con `?ubicacion_rack=3`
- **THEN** devuelve los activos del tenant asignados a cualquier ubicación de ese rack

#### Scenario: Consulta por posición exacta

- **WHEN** se lista con `?ubicacion_id=N`
- **THEN** devuelve sólo los activos asignados a esa posición

## MODIFIED Requirements

### Requirement: Importación masiva desde Excel

El sistema SHALL permitir crear y actualizar activos desde un archivo `.xlsx` con las columnas `uid_fisico`, `nombre`, `familia`, `estado`, `stock_actual`, `stock_minimo`, `valor_reposicion`, `dias_max_prestamo`, `proxima_mantencion`, `ubicacion_rack`, `ubicacion_nivel`, `ubicacion_posicion` y `unidad`, usando `uid_fisico` como clave de upsert. Las columnas nuevas se agregan al final del orden existente, que no se altera.

#### Scenario: Archivo generado con el template anterior

- **WHEN** se importa un archivo con las nueve columnas originales, sin las de ubicación ni unidad
- **THEN** las filas se procesan normalmente: la ubicación queda sin asignar y la unidad toma su valor por defecto

#### Scenario: Fila sin uid_fisico

- **WHEN** una fila viene con `uid_fisico` vacío
- **THEN** se crea un activo nuevo con un UID autogenerado con formato `EFG-XXXXXXXX`

#### Scenario: UID existente del mismo tenant

- **WHEN** el `uid_fisico` ya pertenece a un activo del tenant
- **THEN** el activo se actualiza con los valores de la fila

#### Scenario: UID perteneciente a otro tenant

- **WHEN** el `uid_fisico` existe pero es de otro tenant
- **THEN** la fila se rechaza con el motivo "uid_fisico '<uid>' pertenece a otro tenant" y el resto del archivo continúa procesándose

#### Scenario: Validación previa sin escribir

- **WHEN** se importa con `dry_run=true`
- **THEN** devuelve el conteo de filas válidas para crear y actualizar más la lista de errores por fila, sin modificar la base de datos

#### Scenario: Errores de datos por fila

- **WHEN** una fila omite `nombre` o `familia`, referencia una familia inexistente, un estado inválido, una unidad no soportada o un número/fecha mal formados
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

#### Scenario: Ubicación incompleta en una fila

- **WHEN** una fila trae rack pero deja nivel o posición en blanco
- **THEN** la fila se rechaza con el motivo de que la ubicación requiere rack, nivel y posición

#### Scenario: Descarga del template

- **WHEN** el tenant ya tiene activos y solicita el template
- **THEN** recibe un Excel con sus activos raíz precargados —incluida su ubicación y unidad— para editar y reimportar; si no tiene activos, recibe el template vacío con filas de ejemplo

### Requirement: Listado y consulta de activos

El sistema SHALL exponer listado paginado con filtros opcionales por comportamiento y por rack de ubicación, consulta por ID, y listado de consumibles bajo stock mínimo. Las respuestas incluyen la ubicación y la unidad de medida del activo.

#### Scenario: Filtro por comportamiento

- **WHEN** se lista con `?comportamiento=consumible`
- **THEN** devuelve sólo activos cuya familia tiene ese comportamiento

#### Scenario: Consulta de bajo stock

- **WHEN** se consulta `GET /api/v1/assets/low-stock`
- **THEN** devuelve los consumibles con `stock_actual <= stock_minimo`, cada uno con su ubicación y unidad, para que el bodeguero sepa dónde reponer
