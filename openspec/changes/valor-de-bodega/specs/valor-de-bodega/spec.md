## ADDED Requirements

### Requirement: Valor de las existencias

El sistema SHALL calcular el valor del inventario en existencia como la suma, sobre los consumibles del tenant, de su stock actual por su precio de compra.

#### Scenario: Consumible valorizado

- **WHEN** un consumible tiene 9.000 unidades a $120
- **THEN** aporta $1.080.000 al valor de existencias

#### Scenario: Consumible sin precio

- **WHEN** un consumible no tiene precio configurado
- **THEN** no aporta valor y se cuenta entre los activos sin precio

#### Scenario: Consumible con stock en cero

- **WHEN** un consumible está agotado
- **THEN** aporta cero, que es su valor real

### Requirement: Valor del parque de herramientas

El sistema SHALL calcular el valor de las herramientas como la suma del valor de reposición de cada unidad prestable, reportado en una línea distinta de las existencias.

#### Scenario: Tres unidades del mismo producto

- **WHEN** existen tres lijadoras con valor de reposición $180.000 cada una
- **THEN** aportan $540.000 al valor de herramientas

#### Scenario: Separación de líneas

- **WHEN** se presenta el valor de bodega
- **THEN** existencias y herramientas se muestran por separado, porque una es capital de trabajo y la otra activo fijo

#### Scenario: Herramienta perdida o robada

- **WHEN** una herramienta está en estado Robado
- **THEN** no se cuenta en el valor del parque, porque ya no se tiene

### Requirement: Concentración del valor

El sistema SHALL exponer el detalle de los activos que más valor concentran, ordenados de mayor a menor.

#### Scenario: Vista de concentración

- **WHEN** se consulta el detalle
- **THEN** devuelve los activos de mayor valor primero, no el inventario completo ni un orden alfabético

#### Scenario: Bodega sin activos valorizados

- **WHEN** ningún activo tiene precio ni valor de reposición
- **THEN** el detalle viene vacío y el panel lo indica en vez de mostrar ceros

### Requirement: Antigüedad del último movimiento

Cada activo del detalle SHALL informar cuántos días pasaron desde su último movimiento de inventario, o desde su creación si nunca tuvo ninguno.

#### Scenario: Inventario inmovilizado

- **WHEN** un consumible concentra $3.200.000 y su último movimiento fue hace ocho meses
- **THEN** el detalle muestra ambos datos juntos, de modo que el monto se lea como plata comprada de más

#### Scenario: Inventario con rotación

- **WHEN** un activo de valor similar tuvo movimiento esta semana
- **THEN** se distingue del anterior por su antigüedad, aunque el monto sea parecido

#### Scenario: Activo sin movimientos

- **WHEN** un activo nunca registró movimientos
- **THEN** la antigüedad se cuenta desde su fecha de creación

### Requirement: Activos sin precio informados

El valor de bodega SHALL indicar cuántos activos quedaron fuera del cálculo por no tener precio ni valor de reposición configurado.

#### Scenario: Bodega parcialmente valorizada

- **WHEN** 34 activos no tienen precio
- **THEN** el panel informa esa cantidad junto al total, para que se entienda cuánta confianza merece la cifra

#### Scenario: Bodega completamente valorizada

- **WHEN** todos los activos tienen precio o valor de reposición
- **THEN** no se muestra advertencia alguna

### Requirement: Presentación en el dashboard

El valor de bodega SHALL mostrarse como panel del dashboard, junto al gasto por obra, y no en una pantalla propia.

#### Scenario: Consulta de vistazo

- **WHEN** el dueño abre el dashboard
- **THEN** ve el valor de existencias y de herramientas sin navegar a otra sección

#### Scenario: Desde el panel al activo

- **WHEN** un ítem del detalle llama la atención
- **THEN** se puede abrir ese activo directamente desde el panel
