## ADDED Requirements

### Requirement: Consulta de bodega de sólo lectura

`GET /api/v1/bodega/buscar` SHALL responder, para un texto de búsqueda, qué items del tenant coinciden, cuántos hay disponibles y en qué posición física están. La consulta SHALL estar disponible para cualquier rol autenticado del tenant y NO SHALL modificar nada.

La búsqueda SHALL coincidir por nombre de producto, nombre de variante y **código exacto**: el operario suele llegar con la caja vacía en la mano, y el único dato legible es lo impreso en ella.

#### Scenario: Búsqueda por nombre

- **WHEN** un operario busca "tornillo"
- **THEN** recibe las variantes del tenant cuyo producto o variante contiene ese texto, ordenadas por producto y variante

#### Scenario: Búsqueda por código de la caja

- **WHEN** el texto coincide exactamente con un código registrado del tenant
- **THEN** la variante de ese código encabeza el resultado, sin importar cómo se llame el producto

#### Scenario: Búsqueda sin coincidencias

- **WHEN** ningún item coincide
- **THEN** responde una lista vacía, para que la interfaz pueda decir "no está en catálogo" en vez de "no hay stock", que son cosas distintas

#### Scenario: Texto demasiado corto

- **WHEN** el texto tiene menos de 2 caracteres
- **THEN** responde 422, para no devolver el catálogo entero en una búsqueda accidental

#### Scenario: Aislamiento entre empresas

- **WHEN** un operario busca un material que existe en otro tenant
- **THEN** no aparece en su resultado

### Requirement: Disponibilidad según el comportamiento del item

La consulta SHALL expresar la disponibilidad en los términos del item: un consumible responde con su `stock_actual` y su unidad de medida; un prestable responde con cuántos ejemplares están disponibles sobre el total.

Un operario que pregunta por huincha aisladora quiere un número de rollos; uno que pregunta por el taladro quiere saber si queda alguno libre. Devolver el mismo campo para ambos obliga a interpretarlo, y en el mesón nadie interpreta.

#### Scenario: Consumible con existencias

- **WHEN** se consulta una variante consumible con 240 unidades en stock
- **THEN** responde "240 un" como disponibilidad

#### Scenario: Prestable con ejemplares libres

- **WHEN** se consulta una variante prestable con 3 de 7 unidades en estado Disponible
- **THEN** responde "3 de 7 disponibles"

#### Scenario: Prestable sin ejemplares libres

- **WHEN** todas las unidades de la variante están En Terreno, En Reparación o Robadas
- **THEN** responde "0 de N disponibles" y la interfaz lo marca como sin disponibilidad

#### Scenario: Item agotado pero existente

- **WHEN** la variante existe en el catálogo pero su stock es cero
- **THEN** igualmente aparece en el resultado, marcada como sin stock

### Requirement: Ubicación física en el resultado de la consulta

Cada resultado SHALL incluir su ubicación efectiva como rack, nivel y posición, resolviéndola con la precedencia ya definida —la de la unidad si la tiene, si no la de su variante—.

Saber que hay sirve a medias: el operario que llega diciendo "necesito tornillo 6x40, está en el rack B nivel 2" ahorra el viaje del bodeguero, que es el objetivo del cambio.

#### Scenario: Consumible ubicado

- **WHEN** la variante consumible tiene ubicación asignada
- **THEN** el resultado incluye rack, nivel y posición

#### Scenario: Prestable con ejemplares en distintas posiciones

- **WHEN** las unidades disponibles de una variante prestable están en ubicaciones distintas
- **THEN** el resultado lista la ubicación de cada unidad disponible, no una sola

#### Scenario: Item sin ubicación asignada

- **WHEN** ni la unidad ni la variante tienen ubicación
- **THEN** el resultado indica "sin ubicación asignada" en vez de omitir el campo, para que se note que falta el dato y alguien lo cargue

### Requirement: La consulta no expone información de costo

La respuesta de `/api/v1/bodega/buscar` NO SHALL incluir `precio_compra`, `valor_reposicion`, costo de movimientos ni valorización de ningún tipo, para ningún rol.

El precio de compra es información comercial del tenant y no tiene ninguna función en la pregunta que esta consulta responde. Reutilizar la respuesta del catálogo lo habría filtrado a todo el personal de terreno sin que nadie lo decidiera.

#### Scenario: Consulta hecha por un operario

- **WHEN** un operario busca un material con precio de compra cargado
- **THEN** la respuesta no contiene ningún campo de precio ni de valorización

#### Scenario: Consulta hecha por un administrador

- **WHEN** el mismo endpoint lo llama un usuario con rol admin
- **THEN** la respuesta tampoco incluye costos: para eso está el catálogo, que sí los expone a quien corresponde

### Requirement: Pantalla "Bodega" del operario

El operario SHALL disponer de una pantalla `/bodega` con un único campo de búsqueda enfocado al entrar, que muestra cada coincidencia como una tarjeta con el nombre del item, su disponibilidad y su ubicación.

Se diseña para leerse a una mano y caminando: el operario la consulta de camino al mesón, no sentado.

#### Scenario: Resultado disponible

- **WHEN** el item buscado tiene existencias
- **THEN** la tarjeta muestra la cantidad y la ubicación destacadas, con marca visual de disponible

#### Scenario: Resultado sin existencias

- **WHEN** el item existe pero no hay stock
- **THEN** la tarjeta se muestra atenuada y con la leyenda "Sin stock", sin ocultarla del resultado

#### Scenario: Búsqueda sin resultados

- **WHEN** la búsqueda no arroja coincidencias
- **THEN** la pantalla dice que ese material no está en el catálogo, distinguiéndolo de que exista sin stock

#### Scenario: Consulta desde el teléfono

- **WHEN** la pantalla se abre en un teléfono de 320px
- **THEN** las tarjetas se apilan sin scroll horizontal y los controles conservan los 48px de alto táctil

### Requirement: Vista de préstamos vigentes del operario

La pantalla `/my-loans` SHALL listar los préstamos abiertos del operario autenticado, cada uno con el item, el código principal de la unidad, el proyecto, la fecha de entrega y los días transcurridos desde ella.

#### Scenario: Préstamo vencido

- **WHEN** un préstamo tiene fecha de devolución prevista anterior a hoy
- **THEN** la tarjeta se marca en rojo con la leyenda de devolución vencida

#### Scenario: Operario sin préstamos

- **WHEN** el operario no tiene herramientas en su poder
- **THEN** se muestra el estado vacío "No tienes herramientas en tu poder", no una lista en blanco

#### Scenario: Conteo de días

- **WHEN** la entrega fue ayer por la tarde y se consulta hoy por la mañana
- **THEN** cuenta 1 día transcurrido, comparando fechas de calendario y no horas

### Requirement: Alcance cerrado del rol operario

El rol operario SHALL alcanzar únicamente sus préstamos vigentes y la consulta de bodega. Las pantallas de despacho, mantención de catálogo, movimientos de inventario, usuarios, proyectos y administración NO SHALL estar a su alcance, ni desde el menú ni tipeando la ruta.

El corte por rol SHALL aplicarse en el cliente además del backend. Que el backend niegue los datos no basta: la pantalla igual se abre, se ve rota, y el operario concluye que la aplicación falla.

#### Scenario: Ruta administrativa tipeada a mano

- **WHEN** un operario escribe `/users` o `/catalogo` en la barra de direcciones
- **THEN** se le redirige a su pantalla de entrada en vez de renderizar la pantalla

#### Scenario: Menú lateral del operario

- **WHEN** el operario abre el menú
- **THEN** ve sólo "Mis Préstamos" y "Bodega"

### Requirement: El operario no despacha material

El rol operario NO SHALL tener acceso al escáner de despacho `/catalogo/scan` ni a ninguna acción que descuente stock, cree préstamos o cierre devoluciones.

Despachar es el gesto del bodeguero en el mesón: es él quien verifica qué sale, a quién y para qué obra. Un operario que se autoatiende deja el movimiento registrado a su propio nombre sin que nadie lo haya visto salir, que es exactamente el agujero que este sistema existe para cerrar.

#### Scenario: Escáner fuera del menú del operario

- **WHEN** un usuario con rol operario consulta su menú
- **THEN** el ítem "Escanear" no aparece

#### Scenario: Escáner alcanzado por URL

- **WHEN** un operario navega directamente a `/catalogo/scan`
- **THEN** se le redirige a su pantalla de entrada
