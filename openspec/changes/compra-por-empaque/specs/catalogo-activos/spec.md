## ADDED Requirements

### Requirement: Contenido por empaque del consumible

Un activo SHALL poder declarar cuántas unidades de su unidad de stock trae cada envase en que se compra, mediante `contenido_por_empaque` (hasta tres decimales) y `nombre_empaque` (cómo se llama ese envase). Ambos campos son opcionales y su ausencia deja el comportamiento de compra por unidades intacto.

#### Scenario: Caja de tornillos

- **WHEN** un consumible contado en unidades declara `contenido_por_empaque = 100` y `nombre_empaque = "caja"`
- **THEN** el sistema puede traducir "3 cajas" a 300 unidades al registrar una compra

#### Scenario: Rollo con medida continua

- **WHEN** un consumible medido en metros declara un rollo de 100 metros
- **THEN** una compra de 2 rollos suma 200 metros al stock

#### Scenario: Contenido fraccionario

- **WHEN** el envase trae una medida con decimales, como un tambor de 20,5 litros
- **THEN** el valor se acepta con hasta tres decimales

#### Scenario: Activo sin empaque configurado

- **WHEN** un consumible no declara `contenido_por_empaque`
- **THEN** se compra por unidades exactamente como antes de este cambio

#### Scenario: Contenido no positivo

- **WHEN** se intenta guardar un `contenido_por_empaque` menor o igual a cero
- **THEN** responde 422 indicando que debe ser mayor a 0

### Requirement: Equivalencia en empaques visible

Donde el activo tenga empaque configurado, la interfaz SHALL mostrar el stock en su unidad acompañado del equivalente en empaques, como ayuda de lectura y no como valor editable.

#### Scenario: Stock que calza con empaques completos

- **WHEN** un consumible tiene 9.000 unidades y cajas de 100
- **THEN** se muestra "9.000 un. (90 cajas)"

#### Scenario: Stock que no calza con empaques completos

- **WHEN** el stock es 9.050 unidades con cajas de 100
- **THEN** se muestra el equivalente con un decimal ("90,5 cajas") en vez de redondear

#### Scenario: Edición del stock

- **WHEN** el usuario corrige el stock de un activo con empaque
- **THEN** lo hace siempre en la unidad de stock; no existe un campo editable en empaques

## MODIFIED Requirements

### Requirement: Importación masiva desde Excel

El sistema SHALL permitir crear y actualizar activos desde un archivo `.xlsx` con las columnas `uid_fisico`, `nombre`, `familia`, `estado`, `stock_actual`, `stock_minimo`, `valor_reposicion`, `dias_max_prestamo`, `proxima_mantencion`, `ubicacion_rack`, `ubicacion_nivel`, `ubicacion_posicion`, `unidad`, `codigo_fabricante`, `contenido_por_empaque` y `nombre_empaque`, usando `uid_fisico` como clave de upsert. Las columnas nuevas se agregan al final del orden existente, que no se altera.

#### Scenario: Archivo generado con un template anterior

- **WHEN** se importa un archivo sin las columnas de empaque
- **THEN** las filas se procesan normalmente y el activo queda sin empaque configurado

#### Scenario: Carga masiva de empaques

- **WHEN** una fila trae `contenido_por_empaque = 100` y `nombre_empaque = "caja"`
- **THEN** el activo queda configurado para comprarse por cajas

#### Scenario: Contenido por empaque inválido

- **WHEN** una fila trae un `contenido_por_empaque` que no es un número o es menor o igual a cero
- **THEN** se acumula un error con el número de fila y el motivo, y esa fila se omite

#### Scenario: Fila sin uid_fisico

- **WHEN** una fila viene con `uid_fisico` vacío
- **THEN** se crea un activo nuevo con un UID autogenerado con formato `EFG-XXXXXXXX`

#### Scenario: UID existente del mismo tenant

- **WHEN** el `uid_fisico` ya pertenece a un activo del tenant
- **THEN** el activo se actualiza con los valores de la fila

#### Scenario: Validación previa sin escribir

- **WHEN** se importa con `dry_run=true`
- **THEN** devuelve el conteo de filas válidas para crear y actualizar más la lista de errores por fila, sin modificar la base de datos

#### Scenario: Descarga del template

- **WHEN** el tenant ya tiene activos y solicita el template
- **THEN** recibe un Excel con sus activos raíz precargados —incluidos ubicación, unidad, código de fabricante y configuración de empaque— para editar y reimportar
