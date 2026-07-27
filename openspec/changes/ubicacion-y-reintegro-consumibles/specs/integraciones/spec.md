## MODIFIED Requirements

### Requirement: Consulta de disponibilidad para agentes

`GET /api/v1/assets/query?q=<texto>` SHALL buscar activos raíz del tenant cuyo nombre contenga el texto, con respuesta adaptada al comportamiento de cada uno. Toda respuesta incluye la ubicación en bodega del activo cuando esté registrada, para que el agente pueda indicar dónde encontrarlo.

#### Scenario: Consulta de una herramienta

- **WHEN** el activo encontrado es prestable
- **THEN** la respuesta incluye su estado, el operario que lo tiene (si hay préstamo abierto), la fecha de préstamo formateada como `dd/mm/aaaa hh:mm` y su ubicación en bodega

#### Scenario: Consulta de un consumible

- **WHEN** el activo encontrado es consumible
- **THEN** la respuesta incluye `stock_actual`, `stock_minimo`, la unidad de medida, el indicador `bajo_stock` y su ubicación en bodega

#### Scenario: Pregunta por dónde está algo

- **WHEN** el agente consulta por un consumible ubicado en rack "3", nivel "5", posición "11"
- **THEN** recibe esos tres valores como campos separados, de modo que pueda responder "está en el Rack 3, Nivel 5, Posición 11"

#### Scenario: Activo sin ubicación registrada

- **WHEN** el activo no tiene ubicación asignada
- **THEN** los campos de ubicación vienen nulos y el agente puede responder que no está registrada

#### Scenario: Cantidades decimales

- **WHEN** el consumible tiene stock con decimales
- **THEN** `stock_actual` y `stock_minimo` se devuelven como número JSON con hasta tres decimales, no como texto

#### Scenario: Hijos de kit excluidos

- **WHEN** la búsqueda coincide con activos hijos de un kit
- **THEN** se excluyen del resultado, devolviendo sólo activos raíz
