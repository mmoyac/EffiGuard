## ADDED Requirements

### Requirement: Resolución de escaneo por código de fabricante

Cuando un código escaneado no corresponde a ningún `uid_fisico` del tenant, el sistema SHALL buscarlo como `codigo_fabricante`. El orden es siempre `uid_fisico` primero: el identificador de unidad tiene prioridad sobre el identificador de producto.

#### Scenario: Código de fábrica de un producto con una sola unidad

- **WHEN** se escanea un código de fabricante que corresponde a un único activo del tenant
- **THEN** se resuelve ese activo directamente, con el mismo comportamiento que un escaneo por UID

#### Scenario: Colisión entre un UID y un código de fabricante

- **WHEN** un código coincide con el `uid_fisico` de un consumible y con el `codigo_fabricante` de otras herramientas
- **THEN** se resuelve el consumible, porque la coincidencia por UID tiene prioridad

#### Scenario: Código desconocido

- **WHEN** el código no coincide con ningún `uid_fisico` ni `codigo_fabricante` del tenant
- **THEN** responde 404 con "Activo no encontrado", como hasta ahora

### Requirement: Selección entre unidades candidatas

Cuando un código de fabricante resuelve más de una unidad, el sistema SHALL devolverlas todas como candidatas y la interfaz SHALL pedir al operador que elija una antes de ofrecer cualquier acción. Las candidatas se presentan con nombre, UID, estado y ubicación en bodega, ordenadas poniendo primero las operables.

#### Scenario: Tres atornilladores con el mismo código de fábrica

- **WHEN** se escanea el código de fabricante de un producto del que existen tres unidades
- **THEN** se listan las tres con su UID, estado y ubicación, para que el bodeguero identifique cuál tiene en la mano

#### Scenario: Orden de las candidatas

- **WHEN** entre las candidatas hay unidades Disponibles, En Terreno y en otros estados
- **THEN** se listan primero las Disponibles, luego las En Terreno, y al final el resto

#### Scenario: Acción contextual tras elegir

- **WHEN** el operador selecciona una de las candidatas
- **THEN** se resuelve la acción principal sobre esa unidad concreta, con la misma lógica de precedencia que aplica a cualquier escaneo

#### Scenario: Una sola candidata no abre selector

- **WHEN** el código de fabricante resuelve exactamente una unidad
- **THEN** se abre directamente sin pedir selección

## MODIFIED Requirements

### Requirement: Resolución de activo por UID escaneado

`GET /api/v1/assets/scan/{codigo}` SHALL resolver el código escaneado dentro del tenant y devolver un sobre de resolución que distingue tres desenlaces: una única unidad resuelta, varias unidades candidatas, o ningún resultado. Cuando resuelve una única unidad y ésta es raíz, la respuesta incluye sus hijos.

#### Scenario: UID no registrado

- **WHEN** se escanea un código que no corresponde a ningún activo del tenant
- **THEN** responde 404 con "Activo no encontrado" y la interfaz muestra el error durante 4 segundos

#### Scenario: Resolución única

- **WHEN** el código resuelve exactamente un activo
- **THEN** la respuesta lo devuelve como resolución única, con sus hijos si es raíz

#### Scenario: Resolución múltiple

- **WHEN** el código resuelve varias unidades por coincidencia de código de fabricante
- **THEN** la respuesta las devuelve como candidatas, sin elegir ninguna por el operador

#### Scenario: Escaneo de un hijo de kit

- **WHEN** el activo escaneado tiene `parent_asset_id` no nulo
- **THEN** se devuelve el activo individual, sin expandir el kit
