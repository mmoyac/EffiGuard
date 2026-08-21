## ADDED Requirements

### Requirement: Presentación del préstamo activo según su modalidad

Al escanear una unidad con préstamo abierto, la ficha SHALL presentarlo según la modalidad con que se entregó:

- `plazo` — quién la tiene, desde cuándo, a qué proyecto, quién la entregó, y la fecha en que debe volver o el plazo del catálogo que le aplica; con la marca de atraso cuando corresponda.
- `a_cargo` — "A cargo de &lt;nombre&gt;" desde la fecha de entrega, sin plazo, sin cuenta de días y sin marca de atraso.

En ambos casos la acción principal SHALL seguir siendo "Registrar Devolución": una herramienta a cargo se devuelve con el mismo gesto que cualquier otra.

#### Scenario: Herramienta entregada a cargo

- **WHEN** se escanea una unidad cuyo préstamo activo es `a_cargo`
- **THEN** se muestra "A cargo de <nombre>" con la fecha desde la que la tiene, sin días transcurridos ni marca de atraso, y la acción principal es "Registrar Devolución"

#### Scenario: Herramienta prestada con plazo vencido

- **WHEN** se escanea una unidad cuyo préstamo `plazo` pasó su fecha de devolución
- **THEN** la ficha lo señala como atrasado indicando desde cuándo, sin bloquear ninguna acción

### Requirement: Elección de modalidad al registrar el préstamo

El modal de préstamo SHALL exigir elegir entre "Por N días" y "A cargo" antes de confirmar, con "Por N días" preseleccionado.

Al elegir "Por N días" se muestra el campo de días junto al techo que permite el catálogo para esa herramienta. Al elegir "A cargo" el campo de días desaparece y en su lugar se declara la consecuencia: la herramienta queda bajo la responsabilidad del operario y no se le pedirá devolución.

El plazo va por defecto a propósito: dejar una herramienta a cargo es la decisión mayor de las dos y debe tomarse queriendo, no por descuido.

#### Scenario: Préstamo normal

- **WHEN** el bodeguero abre el modal y confirma sin tocar la modalidad
- **THEN** el préstamo se registra por plazo, como hasta ahora

#### Scenario: Cambio a entrega a cargo

- **WHEN** el bodeguero elige "A cargo"
- **THEN** el campo de días se oculta y se muestra que la herramienta queda a cargo del operario, sin fecha de devolución

#### Scenario: Días por sobre el techo del catálogo

- **WHEN** el bodeguero escribe más días de los que permite el catálogo para esa herramienta
- **THEN** se informa el máximo permitido y se ofrece entregarla a cargo como alternativa, en vez de dejarlo confirmar un préstamo que nacería vencido
