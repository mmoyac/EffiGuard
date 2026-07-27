## ADDED Requirements

### Requirement: Ubicación visible en el resultado del escaneo

El resultado de un escaneo SHALL mostrar la ubicación en bodega del activo cuando esté registrada, de forma legible a distancia de brazo, para que el bodeguero pueda ir a buscarlo sin consultar otra pantalla.

#### Scenario: Consulta de dónde está algo

- **WHEN** se escanea un consumible con rack "3", nivel "5" y posición "11"
- **THEN** la tarjeta del activo muestra "Rack 3 · Nivel 5 · Pos 11"

#### Scenario: Activo sin ubicación registrada

- **WHEN** el activo no tiene ubicación
- **THEN** no se muestra el bloque de ubicación y la tarjeta no deja espacio vacío

### Requirement: Stock expresado con su unidad de medida

El resultado del escaneo de un consumible SHALL mostrar el stock actual acompañado de la unidad del activo y con sus decimales cuando los tenga.

#### Scenario: Consumible medido en metros

- **WHEN** se escanea un consumible con 80,5 metros de stock
- **THEN** se muestra "80,5 m"

#### Scenario: Consumible contado por unidades

- **WHEN** el activo tiene unidad `unidad` y stock 120
- **THEN** se muestra "120" sin decimales

## MODIFIED Requirements

### Requirement: Acciones secundarias del escaneo

Además de la acción principal, la interfaz SHALL ofrecer "Reportar pérdida" para cualquier activo que no esté ya en estado Robado, y "Registrar merma" y "Reintegrar sobrante" sólo para consumibles. "Reintegrar sobrante" se habilita únicamente cuando el consumible tiene despachos con saldo pendiente.

#### Scenario: Activo ya robado

- **WHEN** el activo escaneado está en estado Robado
- **THEN** no se ofrece el botón de reportar pérdida

#### Scenario: Consumible con material despachado sin devolver

- **WHEN** se escanea un consumible que tiene al menos un despacho con saldo pendiente
- **THEN** se ofrece "Reintegrar sobrante", y al pulsarlo se listan esos despachos con su proyecto, operario, fecha y saldo para elegir contra cuál devolver

#### Scenario: Consumible sin despachos pendientes

- **WHEN** todos los despachos del consumible están reintegrados o nunca hubo despachos
- **THEN** la acción "Reintegrar sobrante" no se ofrece
