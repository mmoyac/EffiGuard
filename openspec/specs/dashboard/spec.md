# Dashboard y Reportes Specification

## Purpose

Dar al administrador y al bodeguero una vista inmediata del estado de la bodega: totales, distribución por estado, actividad reciente, quiebres de stock y préstamos vencidos.
## Requirements
### Requirement: KPIs principales

`GET /api/v1/dashboard/stats` SHALL devolver el total de variantes del tenant, el total de unidades físicas, el número de préstamos abiertos y la cantidad de variantes bajo stock mínimo.

#### Scenario: Tenant sin datos

- **WHEN** el tenant no tiene catálogo ni préstamos
- **THEN** los cuatro contadores devuelven 0

#### Scenario: Tenant sólo con consumibles

- **WHEN** el tenant tiene variantes consumibles y ninguna herramienta
- **THEN** el total de unidades físicas es 0 y el de variantes refleja el catálogo completo

### Requirement: Distribución de activos por estado

`GET /api/v1/dashboard/assets-by-state` SHALL devolver el conteo de **unidades** agrupado por nombre de estado, para graficarse como donut. Las variantes consumibles SHALL excluirse, porque no tienen estado.

#### Scenario: Estado sin unidades

- **WHEN** ninguna unidad está en un estado dado
- **THEN** ese estado no aparece en la respuesta

#### Scenario: Tenant sin herramientas

- **WHEN** el tenant sólo tiene consumibles
- **THEN** la respuesta viene vacía y el gráfico muestra su estado vacío

### Requirement: Serie de préstamos por día

`GET /api/v1/dashboard/loans-last-days` SHALL devolver la cantidad de préstamos creados por día en los últimos N días (7 por defecto), rellenando con cero los días sin actividad.

#### Scenario: Día sin préstamos dentro del rango

- **WHEN** un día del rango no registra préstamos
- **THEN** aparece igualmente en la serie con valor 0, manteniendo la continuidad del gráfico

### Requirement: Serie de movimientos de inventario

`GET /api/v1/dashboard/inventory-last-days` SHALL devolver la suma de cantidades movidas por día en los últimos N días (30 por defecto), rellenando los días sin movimientos con cero.

#### Scenario: Rango parametrizado

- **WHEN** se solicita con `?days=15`
- **THEN** la serie contiene exactamente 15 puntos consecutivos

### Requirement: Detalle de quiebres de stock

`GET /api/v1/dashboard/low-stock-detail` SHALL listar las variantes bajo stock mínimo, ordenadas por stock efectivo ascendente, incluyendo nombre del producto, nombre de la variante, y nombre y color de su familia.

#### Scenario: Priorización visual

- **WHEN** hay varias variantes bajo mínimo
- **THEN** la de menor stock efectivo aparece primero

#### Scenario: Quiebre de herramientas

- **WHEN** una variante prestable con `stock_minimo = 2` tiene 1 unidad disponible
- **THEN** aparece en la lista junto a los consumibles, con su stock expresado en unidades disponibles

### Requirement: Panel de préstamos vencidos

El dashboard SHALL exponer los préstamos abiertos que superaron su límite de días, indicando producto, variante, código principal de la unidad, operario, días transcurridos, límite aplicado y días de exceso.

#### Scenario: Orden por gravedad

- **WHEN** hay varios préstamos vencidos
- **THEN** se listan con el mayor exceso de días primero

