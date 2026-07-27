## ADDED Requirements

### Requirement: El retiro siempre se expresa en la unidad de despacho

El retiro de consumibles, la merma, el ajuste, la pérdida y el reintegro SHALL expresarse siempre en la unidad de stock del activo, nunca en empaques. El empaque existe únicamente para el ingreso de compras: de un rollo se cortan metros, no se entregan fracciones de rollo.

#### Scenario: Retiro de un consumible con empaque configurado

- **WHEN** se retira material de un consumible medido en metros que se compra por rollos de 100
- **THEN** la cantidad se pide en metros, y la interfaz lo indica explícitamente para que no se confunda con rollos

#### Scenario: Referencia visual del empaque

- **WHEN** se muestra el stock disponible de un consumible con empaque configurado
- **THEN** se acompaña del equivalente en empaques como referencia de lectura, sin que sea la unidad en que se opera

#### Scenario: Cantidad expresada con su unidad

- **WHEN** la interfaz pide o confirma una cantidad
- **THEN** la unidad acompaña al número en la etiqueta, en el campo y en el botón de confirmación, de modo que nunca se muestre una cifra sin unidad

### Requirement: Decimales según la naturaleza de la unidad

Las cantidades SHALL admitir decimales cuando la unidad representa una magnitud continua —metro, kilo, litro— y restringirse a enteros cuando la unidad es discreta. No existe medio tornillo, pero sí medio metro de cable.

#### Scenario: Retiro fraccionario de una magnitud continua

- **WHEN** se retiran 12,5 metros de un consumible medido en metros
- **THEN** la cantidad se acepta con decimales

#### Scenario: Unidad discreta

- **WHEN** el consumible se cuenta por unidades
- **THEN** la cantidad se restringe a enteros

#### Scenario: Cantidad que supera el stock

- **WHEN** la cantidad ingresada supera el stock disponible
- **THEN** la interfaz lo advierte indicando el máximo con su unidad y bloquea la confirmación, sin depender de que el servidor rechace la operación

## MODIFIED Requirements

### Requirement: Registro de compra

`POST /api/v1/assets/{asset_id}/purchase` SHALL sumar unidades al stock de un consumible y registrar un log tipo `compra`. La cantidad puede expresarse de dos formas excluyentes: `cantidad` en la unidad de stock, o `empaques` en el envase configurado del activo. El movimiento se registra siempre en la unidad de stock.

#### Scenario: Compra expresada en empaques

- **WHEN** llegan 3 cajas de un consumible con `contenido_por_empaque = 100`
- **THEN** el stock sube 300 unidades y el log registra cantidad 300, no 3

#### Scenario: Constancia del empaque original

- **WHEN** se registra una compra por empaques
- **THEN** la observación del movimiento deja constancia del envase ("Compra: 3 cajas de 100 unidad"), para poder auditarlo contra la factura del proveedor

#### Scenario: Observación propia del usuario

- **WHEN** el usuario escribe su propia observación en una compra por empaques
- **THEN** la constancia del empaque se antepone a su texto en vez de reemplazarlo

#### Scenario: Compra expresada en unidades

- **WHEN** se envía `cantidad` en vez de `empaques`
- **THEN** el comportamiento es idéntico al anterior a este cambio

#### Scenario: Ambos campos enviados

- **WHEN** la petición trae `cantidad` y `empaques` a la vez
- **THEN** responde 400 indicando que debe enviarse exactamente uno, sin suponer cuál quiso decir el usuario

#### Scenario: Ningún campo enviado

- **WHEN** la petición no trae ni `cantidad` ni `empaques`
- **THEN** responde 400 indicando que debe enviarse exactamente uno

#### Scenario: Empaques sobre un activo sin empaque configurado

- **WHEN** se envía `empaques` para un activo que no declara `contenido_por_empaque`
- **THEN** responde 400 indicando que hay que configurar el contenido por empaque, sin asumir un valor por defecto

#### Scenario: Cantidad no positiva

- **WHEN** la cantidad o los empaques son menores o iguales a cero
- **THEN** responde 400 con "La cantidad debe ser mayor a 0"

#### Scenario: Activo prestable

- **WHEN** el activo no es consumible
- **THEN** responde 400 con "Solo aplica a consumibles"
