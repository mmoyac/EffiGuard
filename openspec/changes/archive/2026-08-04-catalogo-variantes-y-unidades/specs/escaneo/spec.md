## MODIFIED Requirements

### Requirement: Resolución de activo por UID escaneado

`GET /api/v1/scan/{codigo}` SHALL resolver, en una sola consulta sobre `codigos`, el item del tenant al que pertenece el código escaneado, sea una variante o una unidad. La respuesta SHALL indicar cuál de los dos resolvió, y para una unidad raíz SHALL incluir sus unidades hijas.

#### Scenario: Código no registrado

- **WHEN** se escanea un código que no corresponde a ninguna variante ni unidad del tenant
- **THEN** responde 404 con "Código no encontrado" y la interfaz muestra el error durante 4 segundos

#### Scenario: Código de proveedor de un consumible

- **WHEN** se escanea cualquiera de los códigos de proveedor de una variante consumible
- **THEN** resuelve a esa variante, con el mismo resultado que el código propio: un solo stock, una sola posición

#### Scenario: Código de una herramienta

- **WHEN** se escanea el código principal o la serie de fábrica de una unidad
- **THEN** resuelve a esa unidad, con su estado, su variante y su producto

#### Scenario: EAN de fábrica de una herramienta

- **WHEN** se escanea el EAN impreso en la caja de un modelo del que hay 3 ejemplares
- **THEN** resuelve a la **variante**, no a un ejemplar, porque ese código identifica el modelo y los tres lo comparten; la interfaz muestra cuántos hay disponibles y ofrece elegir cuál prestar

#### Scenario: Escaneo de una unidad hija de kit

- **WHEN** la unidad escaneada tiene `parent_unidad_id` no nulo
- **THEN** se devuelve la unidad individual, sin expandir el kit

#### Scenario: Código de otro tenant

- **WHEN** se escanea un código registrado en un tenant distinto al de la sesión
- **THEN** responde 404, porque la resolución está acotada al tenant

### Requirement: Acción principal derivada del contexto del activo

Tras un escaneo, la interfaz SHALL resolver una única acción principal según lo que haya resuelto el código, con esta precedencia:

1. El código resolvió a una **variante consumible** → "Retirar Consumible"
2. Unidad en estado En Reparación → "Marcar como reparada"
3. Unidad en estado distinto de Disponible o En Terreno → "No disponible para operar"
4. Unidad con préstamo activo → "Registrar Devolución"
5. Unidad que es kit padre → "Prestar Kit Completo"
6. Resto → "Registrar Préstamo"

El escaneo NO SHALL ofrecer registrar compras. Escanear es el gesto de **despachar**: se hace en el mesón con el operario esperando, y ofrecer ahí una acción que suma stock invita a confundir una entrega con una recepción. La compra vive en la mantención del catálogo, que es donde se recibe mercadería con la factura a la vista.

#### Scenario: Herramienta disponible sin hijas

- **WHEN** se escanea una unidad en estado Disponible sin préstamo activo ni unidades hijas
- **THEN** la acción ofrecida es "Registrar Préstamo"

#### Scenario: Herramienta en terreno

- **WHEN** se escanea una unidad con préstamo abierto
- **THEN** la acción ofrecida es "Registrar Devolución" y se muestra quién la tiene, desde cuándo, quién la entregó y a qué proyecto

#### Scenario: Herramienta robada

- **WHEN** se escanea una unidad en estado Robado
- **THEN** se muestra "No disponible para operar" y no se ofrece acción principal

#### Scenario: Consumible

- **WHEN** se escanea un código de una variante consumible
- **THEN** se muestra el stock actual, resaltado en amarillo si está bajo el mínimo, y la acción es "Retirar Consumible"

#### Scenario: Consumible escaneado por su empaque

- **WHEN** se escanea el código de la caja de 250 de una variante consumible
- **THEN** la acción principal sigue siendo "Retirar Consumible": el código del empaque identifica la misma variante y el mismo pozo de stock, y su factor sólo aplica al ingresar mercadería

### Requirement: Acciones secundarias del escaneo

Además de la acción principal, la interfaz SHALL ofrecer "Reportar pérdida" para cualquier item que no esté ya en estado Robado, y "Registrar merma" sólo para variantes consumibles.

#### Scenario: Unidad ya robada

- **WHEN** la unidad escaneada está en estado Robado
- **THEN** no se ofrece el botón de reportar pérdida

#### Scenario: Merma sobre una herramienta

- **WHEN** el código resuelve a una unidad prestable
- **THEN** no se ofrece "Registrar merma"

## ADDED Requirements

### Requirement: Alta de código desde un escaneo sin resultado

Cuando un escaneo no resuelve a ningún item, la interfaz SHALL ofrecer asociar ese código a una variante o unidad existente, sin salir del flujo de escaneo.

#### Scenario: Código nuevo de un proveedor conocido

- **WHEN** llega un lote del mismo tornillo con un código de proveedor no registrado y el bodeguero lo escanea
- **THEN** se ofrece buscar la variante y asociarle el código con su tipo, proveedor y factor

#### Scenario: Asociación de un código ya usado

- **WHEN** se intenta asociar un código que ya pertenece a otro item del tenant
- **THEN** responde 409 con "El código '<codigo>' ya está registrado en otro item" y se ofrece ir a ese item
