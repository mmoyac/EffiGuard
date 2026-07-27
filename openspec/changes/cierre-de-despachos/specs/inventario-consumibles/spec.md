## ADDED Requirements

### Requirement: Cierre de un despacho

Un despacho de consumible SHALL considerarse **abierto** mientras no tenga ningún reintegro que lo referencie y su proyecto esté activo. Sólo los despachos abiertos admiten reintegro. El estado se deriva de esos dos hechos y no se almacena.

#### Scenario: Despacho cerrado por su reintegro

- **WHEN** un despacho recibe su reintegro
- **THEN** queda cerrado: lo devuelto vuelve al stock y lo que no volvió queda declarado como consumo del proyecto

#### Scenario: Despacho cerrado por fin de obra

- **WHEN** se desactiva el proyecto al que se imputó un despacho sin reintegro
- **THEN** el despacho deja de estar abierto y su cantidad completa queda como consumo de ese proyecto

#### Scenario: Reapertura al reactivar el proyecto

- **WHEN** un proyecto desactivado se vuelve a activar
- **THEN** sus despachos sin reintegro vuelven a estar abiertos, porque el material puede volver si la obra se retomó

#### Scenario: Despacho sin proyecto

- **WHEN** un retiro se registró sin imputar proyecto
- **THEN** permanece abierto hasta que reciba su reintegro, ya que no tiene evento de cierre asociado

#### Scenario: El cierre no altera el consumo

- **WHEN** se compara el consumo de un proyecto antes y después de cerrarse un despacho
- **THEN** el valor es el mismo: el consumo siempre es lo despachado menos lo reintegrado, y el cierre sólo determina qué se ofrece para reintegrar

## MODIFIED Requirements

### Requirement: Reintegro de material sobrante

El sistema SHALL permitir devolver al stock el material despachado que no se consumió, mediante un movimiento `reintegro` que referencia el despacho de origen. El reintegro suma la cantidad al `stock_actual`, hereda el proyecto y el operario del despacho referenciado, y **cierra ese despacho**: cada despacho admite un único reintegro.

#### Scenario: Vuelve material de un despacho

- **WHEN** se despacharon 100 metros de cable al Proyecto X y vuelven 20
- **THEN** el stock sube 20 metros, se registra un log `reintegro` de 20 que referencia el despacho, el despacho queda cerrado y el consumo del Proyecto X por ese despacho queda en 80 metros

#### Scenario: Segundo reintegro sobre el mismo despacho

- **WHEN** se intenta reintegrar contra un despacho que ya tiene un reintegro
- **THEN** responde 400 indicando que esa entrega ya fue cerrada, y el stock no se modifica

#### Scenario: Reintegro sobre un despacho de proyecto desactivado

- **WHEN** se intenta reintegrar contra un despacho cuyo proyecto ya no está activo
- **THEN** responde 400 indicando que la obra está cerrada y su material quedó declarado como consumo

#### Scenario: Reintegro mayor a lo despachado

- **WHEN** se intenta reintegrar más de lo que salió en ese despacho
- **THEN** responde 400 indicando la cantidad máxima, y el stock no se modifica

#### Scenario: Reintegro sobre un despacho de otro activo o de otro tenant

- **WHEN** el movimiento de origen no corresponde al activo indicado o pertenece a otro tenant
- **THEN** responde 404 sin revelar la existencia del movimiento

#### Scenario: Origen que no es un despacho de consumible

- **WHEN** el movimiento referenciado no es de tipo `entrega` o el activo no es consumible
- **THEN** responde 400 indicando que sólo se puede reintegrar contra despachos de consumibles

#### Scenario: Cantidad no positiva

- **WHEN** la cantidad a reintegrar es menor o igual a cero
- **THEN** responde 400 con "La cantidad debe ser mayor a 0"

#### Scenario: Confirmación antes de una operación irreversible

- **WHEN** el operador va a confirmar un reintegro
- **THEN** la interfaz muestra cuánto vuelve al stock, cuánto queda como consumo y de qué proyecto, y advierte que la entrega se cierra

### Requirement: Saldo pendiente de los despachos

El sistema SHALL exponer, por consumible, los despachos **abiertos** con su saldo por devolver, entendido como la cantidad entregada menos lo reintegrado. El saldo se calcula al consultar, no se almacena.

#### Scenario: Consulta de despachos abiertos de un consumible

- **WHEN** se consultan los despachos disponibles para reintegro de un consumible
- **THEN** devuelve sólo los que no tienen reintegro y cuyo proyecto está activo, con su proyecto, operario, fecha y saldo, más recientes primero

#### Scenario: Despacho ya reintegrado

- **WHEN** un despacho recibió su reintegro
- **THEN** deja de aparecer en la lista

#### Scenario: Despacho de una obra terminada

- **WHEN** el proyecto del despacho fue desactivado
- **THEN** el despacho no aparece en la lista, aunque nunca haya recibido un reintegro

#### Scenario: Consumible sin despachos abiertos

- **WHEN** todos los despachos están cerrados o nunca hubo despachos
- **THEN** la lista viene vacía y la interfaz no ofrece la acción de reintegro
