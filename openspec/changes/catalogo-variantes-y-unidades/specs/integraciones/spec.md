## MODIFIED Requirements

### Requirement: Consulta de disponibilidad para agentes

`GET /api/v1/assets/query?q=<texto>` SHALL buscar variantes del tenant cuyo nombre de producto o de variante contenga el texto, con respuesta adaptada al comportamiento de su familia.

#### Scenario: Consulta de una herramienta

- **WHEN** la variante encontrada es prestable
- **THEN** la respuesta incluye `unidades_total`, `unidades_disponibles` y el detalle de las unidades prestadas con su operario y fecha de préstamo formateada como `dd/mm/aaaa hh:mm`

#### Scenario: Consulta de un consumible

- **WHEN** la variante encontrada es consumible
- **THEN** la respuesta incluye `stock_actual`, `stock_minimo` y el indicador `bajo_stock`

#### Scenario: Coincidencia por nombre de producto

- **WHEN** el texto coincide con el nombre del producto y éste tiene tres variantes
- **THEN** se devuelven las tres, cada una con su propia disponibilidad, agrupadas bajo el nombre del producto

#### Scenario: Unidades hijas de kit excluidas

- **WHEN** hay un kit prestado, con un préstamo por cada pieza
- **THEN** `prestadas_a` lista sólo la unidad raíz, para no repetir al mismo operario una vez por pieza de una única entrega

#### Scenario: Campos siempre presentes

- **WHEN** el agente recibe cualquier resultado
- **THEN** todos los campos vienen, y los que no aplican al comportamiento llegan en cero o vacíos, para que el consumidor no tenga que ramificar según el tipo antes de leer

#### Scenario: Búsqueda por código

- **WHEN** el texto enviado corresponde exactamente a un código registrado
- **THEN** se devuelve la variante o unidad dueña de ese código, para que el agente pueda responder por número de parte de proveedor
