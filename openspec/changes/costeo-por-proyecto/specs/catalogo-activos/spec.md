## ADDED Requirements

### Requirement: Precio de compra del consumible

Un consumible SHALL poder declarar `precio_compra`: cuánto cuesta **una unidad de stock**, no un empaque. El campo es opcional y su ausencia deja los movimientos sin valorizar.

#### Scenario: Precio por unidad de despacho

- **WHEN** una caja de 100 tornillos cuesta $12.000
- **THEN** el precio de compra del activo es $120, expresado en la misma unidad en que vive el stock

#### Scenario: Ingreso a partir del precio del empaque

- **WHEN** el usuario conoce el precio de la caja y el activo declara su contenido por empaque
- **THEN** el formulario acepta el precio del empaque y lo divide por el contenido, igual que la compra acepta cajas y guarda unidades

#### Scenario: Precio no positivo

- **WHEN** se intenta guardar un precio menor o igual a cero
- **THEN** responde 422 indicando que debe ser mayor a 0

#### Scenario: Distinción con el valor de reposición

- **WHEN** un activo declara precio de compra y valor de reposición
- **THEN** el precio de compra valoriza sus movimientos y el valor de reposición valoriza su pérdida, sin que uno sustituya al otro

## MODIFIED Requirements

### Requirement: Importación masiva desde Excel

El sistema SHALL permitir crear y actualizar activos desde un archivo `.xlsx` con las columnas `uid_fisico`, `nombre`, `familia`, `estado`, `stock_actual`, `stock_minimo`, `valor_reposicion`, `dias_max_prestamo`, `proxima_mantencion`, `ubicacion_rack`, `ubicacion_nivel`, `ubicacion_posicion`, `unidad`, `codigo_fabricante`, `contenido_por_empaque`, `nombre_empaque` y `precio_compra`, usando `uid_fisico` como clave de upsert. Las columnas nuevas se agregan al final del orden existente, que no se altera.

#### Scenario: Archivo generado con un template anterior

- **WHEN** se importa un archivo sin la columna de precio
- **THEN** las filas se procesan normalmente y el activo queda sin precio configurado

#### Scenario: Carga masiva de precios

- **WHEN** una fila trae `precio_compra`
- **THEN** el activo queda configurado para valorizar sus movimientos futuros

#### Scenario: Precio inválido

- **WHEN** una fila trae un precio que no es un número, o es menor o igual a cero
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
- **THEN** recibe un Excel con sus activos raíz precargados —incluidos ubicación, unidad, código de fabricante, empaque y precio de compra— para editar y reimportar
