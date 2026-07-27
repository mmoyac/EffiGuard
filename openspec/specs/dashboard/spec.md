# Dashboard y Reportes Specification

## Purpose

Dar al administrador y al bodeguero una vista inmediata del estado de la bodega: totales, distribución por estado, actividad reciente, quiebres de stock y préstamos vencidos.

## Requirements

### Requirement: KPIs principales

`GET /api/v1/dashboard/stats` SHALL devolver el total de activos del tenant, el número de préstamos abiertos y la cantidad de consumibles bajo stock mínimo.

#### Scenario: Tenant sin datos

- **WHEN** el tenant no tiene activos ni préstamos
- **THEN** los tres contadores devuelven 0

### Requirement: Distribución de activos por estado

`GET /api/v1/dashboard/assets-by-state` SHALL devolver el conteo de activos agrupado por nombre de estado, para graficarse como donut.

#### Scenario: Estado sin activos

- **WHEN** ningún activo está en un estado dado
- **THEN** ese estado no aparece en la respuesta

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

`GET /api/v1/dashboard/low-stock-detail` SHALL listar los consumibles con `stock_actual <= stock_minimo`, ordenados por stock ascendente, incluyendo nombre y color de su familia.

#### Scenario: Priorización visual

- **WHEN** hay varios consumibles bajo mínimo
- **THEN** el de menor stock aparece primero

### Requirement: Panel de préstamos vencidos

El dashboard SHALL exponer los préstamos abiertos que superaron su límite de días, indicando activo, operario, días transcurridos, límite aplicado y días de exceso.

#### Scenario: Orden por gravedad

- **WHEN** hay varios préstamos vencidos
- **THEN** se listan con el mayor exceso de días primero
