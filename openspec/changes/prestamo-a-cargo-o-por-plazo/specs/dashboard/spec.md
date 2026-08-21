## MODIFIED Requirements

### Requirement: Panel de préstamos vencidos

El dashboard SHALL exponer los préstamos abiertos que superaron su plazo, indicando producto, variante, código principal de la unidad, operario, días transcurridos, plazo aplicado, días de exceso y el origen del plazo incumplido (`pactado` cuando viene de la fecha acordada al entregar, `catalogo` cuando viene del `dias_max_prestamo` de la variante o su familia).

Las herramientas entregadas a cargo NO SHALL aparecer en este panel. El panel sirve para salir a buscar lo que debería haber vuelto; si se llena de entregas que nadie espera de vuelta, deja de mirarse y con él se pierde el aviso de la herramienta que sí está atrasada.

#### Scenario: Orden por gravedad

- **WHEN** hay varios préstamos vencidos
- **THEN** se listan con el mayor exceso de días primero

#### Scenario: Origen del plazo visible

- **WHEN** un préstamo venció por la fecha que el bodeguero pactó al entregarlo
- **THEN** el panel lo indica como plazo pactado, para distinguirlo de los que vencieron por el límite del catálogo

#### Scenario: Entregas a cargo fuera del panel

- **WHEN** hay herramientas entregadas a cargo desde hace meses
- **THEN** ninguna aparece en el panel de vencidos, sin importar cuánto tiempo lleven fuera de bodega
