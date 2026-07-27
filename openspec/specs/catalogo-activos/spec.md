# Catálogo de Activos Specification

## Purpose

Modelar los bienes del tenant —herramientas prestables y consumibles de stock— con un identificador físico único, familias parametrizables por el cliente, soporte de kits padre-hijo y carga masiva vía Excel.

## Requirements

### Requirement: Activo identificado por UID físico único

Cada activo SHALL tener un `uid_fisico` único en todo el sistema, correspondiente a su código QR o tag RFID.

#### Scenario: Alta con UID ya existente

- **WHEN** se intenta crear un activo con un `uid_fisico` ya registrado
- **THEN** responde 409 con "Ya existe un activo con el código '<uid>'"

### Requirement: Comportamiento derivado de la familia

El comportamiento operativo de un activo SHALL determinarse por su familia (`asset_families.comportamiento`), con dos valores válidos: `prestable` (requiere préstamo y devolución) y `consumible` (sólo descuenta stock). Un activo no declara su tipo directamente.

#### Scenario: Creación de familia con comportamiento inválido

- **WHEN** se crea una familia con un `comportamiento` distinto de `prestable` o `consumible`
- **THEN** responde 422 con "comportamiento debe ser 'prestable' o 'consumible'"

#### Scenario: Familia con color fuera del set permitido

- **WHEN** se crea una familia con un color fuera de {blue, orange, green, purple, red, yellow, pink, cyan}
- **THEN** responde 422 listando las opciones válidas

#### Scenario: Familias por defecto de un tenant nuevo

- **WHEN** el Super Admin crea un tenant
- **THEN** se siembran dos familias: "Herramienta" (prestable, blue) y "Consumible" (consumible, orange)

### Requirement: Familia no eliminable con activos asignados

Una familia SHALL poder eliminarse sólo si ningún activo la referencia.

#### Scenario: Intento de borrar familia en uso

- **WHEN** se elimina una familia con N activos asignados
- **THEN** responde 409 con "No se puede eliminar: la familia tiene N activo(s) asignado(s)"

### Requirement: Estados de activo

Todo activo SHALL tener un estado del catálogo global, con IDs estables usados por la lógica de negocio: 1 Disponible, 2 En Terreno, 3 En Reparación, 4 Robado.

#### Scenario: Activo en estado no operable

- **WHEN** se escanea un activo cuyo estado no es Disponible, En Terreno ni En Reparación
- **THEN** la interfaz muestra "No disponible para operar" y no ofrece acción principal

### Requirement: Kits padre-hijo

Un activo SHALL poder tener hijos mediante `parent_asset_id`, formando un kit. El padre es el activo con `parent_asset_id IS NULL` que tiene hijos vinculados.

#### Scenario: Consulta de un activo padre

- **WHEN** se obtiene un activo raíz
- **THEN** la respuesta incluye la colección de sus hijos

### Requirement: Límite de días de préstamo con herencia

El límite de días de préstamo SHALL resolverse con precedencia: `assets.dias_max_prestamo` si está definido, si no `asset_families.dias_max_prestamo`, y si ambos son nulos el activo no tiene límite.

#### Scenario: Activo sin límite propio

- **WHEN** el activo tiene `dias_max_prestamo = NULL` y su familia define 7 días
- **THEN** el límite efectivo del activo es 7 días

#### Scenario: Activo y familia sin límite

- **WHEN** ambos valores son nulos
- **THEN** el activo nunca se reporta como vencido

### Requirement: Catálogo de marcas y modelos

El tenant SHALL poder mantener marcas y modelos propios (`brands`, `models`), con el modelo opcional en el activo.

#### Scenario: Listado de modelos por marca

- **WHEN** se consulta `GET /api/v1/catalog/models?brand_id=N`
- **THEN** devuelve sólo los modelos de esa marca dentro del tenant

### Requirement: Eliminación de activo bloqueada por préstamo activo

Un activo SHALL poder eliminarse sólo si no tiene préstamos abiertos. Al eliminarlo se borran en cascada sus logs de inventario y sus préstamos históricos.

#### Scenario: Borrado con préstamo abierto

- **WHEN** se elimina un activo con un préstamo sin `fecha_devolucion_real`
- **THEN** responde 409 con "No se puede eliminar: el activo tiene un préstamo activo"

### Requirement: Importación masiva desde Excel

El sistema SHALL permitir crear y actualizar activos desde un archivo `.xlsx` con las columnas `uid_fisico`, `nombre`, `familia`, `estado`, `stock_actual`, `stock_minimo`, `valor_reposicion`, `dias_max_prestamo`, `proxima_mantencion`, usando `uid_fisico` como clave de upsert.

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

- **WHEN** una fila omite `nombre` o `familia`, referencia una familia inexistente, un estado inválido o un número/fecha mal formados
- **THEN** se acumula un error con el número de fila y el motivo, y esa fila se omite

#### Scenario: Descarga del template

- **WHEN** el tenant ya tiene activos y solicita el template
- **THEN** recibe un Excel con sus activos raíz precargados para editar y reimportar; si no tiene activos, recibe el template vacío con filas de ejemplo

### Requirement: Listado y consulta de activos

El sistema SHALL exponer listado paginado con filtro opcional por comportamiento, consulta por ID, y listado de consumibles bajo stock mínimo.

#### Scenario: Filtro por comportamiento

- **WHEN** se lista con `?comportamiento=consumible`
- **THEN** devuelve sólo activos cuya familia tiene ese comportamiento

#### Scenario: Consulta de bajo stock

- **WHEN** se consulta `GET /api/v1/assets/low-stock`
- **THEN** devuelve los consumibles con `stock_actual <= stock_minimo`
