## Context

`assets.uid_fisico` cumple hoy dos papeles que en realidad son distintos: es el identificador de la unidad física y es, de paso, el único código que el sistema conoce. Cuando el código lo genera EffiGuard eso funciona. Cuando el código lo trae el fabricante, deja de funcionar, porque un EAN identifica al producto y no a la unidad: los tres atornilladores Bosch idénticos lo comparten.

Dos hechos del código actual condicionan el diseño:

- `uid_fisico` tiene `UNIQUE` global, no por tenant (`001_initial_schema.py`). El importador ya convive con esa limitación rechazando filas con el motivo "uid_fisico pertenece a otro tenant".
- `get_by_uid()` resuelve con `scalar_one_or_none()`, así que la unicidad no es decorativa: si hubiera dos filas con el mismo código, el escaneo lanzaría `MultipleResultsFound`.

`brands` y `models` existen pero están prácticamente sin uso: `assets.model_id` es nulo y el importador nunca lo asigna.

## Goals / Non-Goals

**Goals:**

- Conservar el código de fábrica del producto sin sacrificar la identificación por unidad.
- Permitir que un consumible use directamente el EAN del fabricante como su código físico.
- Que escanear un código de fábrica conocido resuelva a la unidad correcta, o deje elegir entre las candidatas.
- Que dar de alta una unidad nueva de un producto ya conocido no exija volver a tipear sus atributos.

**Non-Goals:**

- Un catálogo maestro de productos compartido entre tenants. Cada tenant sigue con sus propios activos.
- Consultar catálogos externos de EAN para autocompletar nombre o marca desde internet.
- Poblar `brands` y `models`, que siguen igual de opcionales que hoy.
- Generar códigos EAN propios. EffiGuard sigue generando UID con formato `EFG-XXXXXXXX`.

## Decisions

### El código de fabricante va en el activo, no en `models`

`assets` incorpora `codigo_fabricante` (`varchar(50)`, nulo, indexado, **no** único).

Normalizar en `models` sería lo ortodoxo: el código pertenece al producto, y las tres unidades apuntarían a la misma fila. Se descarta porque `models` está sin uso real —`model_id` es nulo y el importador no lo asigna—, así que colgar el código de ahí obligaría al bodeguero a mantener un catálogo de marcas y modelos antes de poder guardar un EAN. El costo de la denormalización es que las tres filas repiten el mismo código; como es una clave de búsqueda y no una fuente de verdad, es asumible.

El índice no es único justamente porque las unidades del mismo producto lo comparten: es lo que permite que una búsqueda por código devuelva las tres.

### `uid_fisico` pasa a ser único por tenant

La constraint `UNIQUE (uid_fisico)` se reemplaza por `UNIQUE (tenant_id, uid_fisico)`.

Con códigos generados por EffiGuard la unicidad global era un exceso inofensivo. Con códigos universales pasa a ser un defecto: dos clientes que compran el mismo producto a Bosch chocan siempre, y el primero que registre el EAN se lo quita a todos los demás para siempre. El aislamiento por tenant es además la regla que rige el resto del sistema; esta columna era la excepción.

Efecto colateral: el importador deja de necesitar la validación cruzada contra UID de otros tenants, y el mensaje de error correspondiente desaparece.

### El escaneo resuelve en dos pasos, con `uid_fisico` primero

`scan_asset()` busca coincidencia exacta de `uid_fisico`. Si no encuentra, busca por `codigo_fabricante`.

El orden importa y no es arbitrario: un consumible puede tener el EAN cargado como su `uid_fisico` y, a la vez, existir herramientas con ese mismo código en `codigo_fabricante`. Dando prioridad al identificador de unidad, el caso más específico gana y el comportamiento actual del escaneo queda intacto para todos los activos ya cargados.

### El escaneo devuelve un sobre de resolución

`GET /api/v1/assets/scan/{codigo}` deja de devolver el activo plano y pasa a devolver:

- `{"tipo": "unico", "asset": {...}}` cuando resuelve una sola unidad, sea por UID o por código de fabricante.
- `{"tipo": "multiple", "codigo_fabricante": "...", "candidatos": [...]}` cuando el código de fabricante resuelve varias, con estado y ubicación de cada una.
- `404` cuando no resuelve nada, como hoy.

*Alternativa considerada:* dejar `/assets/scan` intacto y agregar un endpoint paralelo de resolución. Se descarta porque tendría dos puertas de entrada para el mismo gesto del usuario y el frontend terminaría llamando a ambas. El único consumidor de este endpoint es el propio escáner de EffiGuard; n8n usa `/assets/query`, que no cambia.

*Un solo candidato no abre selector.* Si el código de fabricante resuelve una sola unidad, se comporta exactamente como un escaneo por UID: no tiene sentido pedirle al bodeguero que elija de una lista de uno.

### La selección de candidata ocurre antes de resolver la acción

Cuando el escaneo devuelve varias candidatas, la interfaz muestra la lista —nombre, UID, estado y ubicación— y sólo tras elegir una se calcula la acción contextual con la lógica que ya existe. La resolución de acción no se toca: sigue operando sobre un activo concreto.

Las candidatas se ordenan poniendo primero las operables (Disponible, luego En Terreno), porque en la práctica el bodeguero está entregando o recibiendo, no consultando el inventario.

### El alta por código clona la unidad más reciente del producto

`POST /api/v1/assets/from-codigo-fabricante` recibe un código y una cantidad, y crea esa cantidad de unidades copiando `nombre`, `family_id`, `model_id`, `valor_reposicion`, `dias_max_prestamo`, `unidad` y `codigo_fabricante` de la unidad existente más reciente con ese código. Cada una recibe su `uid_fisico` autogenerado y queda en estado Disponible.

Se clona de la unidad más reciente y no de un "producto" porque no existe tal entidad; la última unidad cargada es la mejor aproximación disponible a los atributos vigentes del producto. La ubicación **no** se hereda: la herramienta que acaba de llegar todavía no está guardada en ninguna parte, y heredarla afirmaría algo falso.

Si el código no corresponde a ninguna unidad existente, el endpoint responde 404 y el bodeguero sigue por el alta manual, indicando el código para que la próxima vez sí se pueda clonar.

### La columna del Excel se agrega al final

Mismo criterio que el cambio de ubicación: `codigo_fabricante` se agrega al final de `_COLUMNS`, sin alterar el orden existente, para que los archivos ya descargados sigan importándose.

## Risks / Trade-offs

**El código de fabricante repetido en N filas puede quedar inconsistente** si alguien lo edita en una unidad y no en las otras → La búsqueda por código seguiría funcionando para las que lo conserven. Es el precio de no exigir el catálogo de modelos; si más adelante `models` se empieza a usar de verdad, migrar el código a esa tabla es un `UPDATE` con `JOIN`.

**Cambiar el contrato de `/assets/scan` rompe el frontend hasta que se despliegue el nuevo** → Backend y frontend se despliegan juntos. No hay clientes externos de ese endpoint.

**Un EAN mal leído puede crear unidades de un producto equivocado** en el alta rápida → El endpoint devuelve las unidades creadas y la interfaz muestra qué producto se clonó antes de confirmar, de modo que el error se ve antes de imprimir etiquetas.

**Quitar la unicidad global permite que dos tenants usen el mismo código**, que es justamente el objetivo, pero elimina una red de seguridad accidental contra cargar un activo en el tenant equivocado → El aislamiento por tenant del resto del sistema ya cubre ese riesgo: un activo cargado en el tenant equivocado nunca es visible desde otro.

## Migration Plan

1. Migración Alembic que agrega `assets.codigo_fabricante` con su índice, elimina la constraint única global de `uid_fisico` y crea `UNIQUE (tenant_id, uid_fisico)`.
2. Despliegue conjunto de backend y frontend por el cambio de contrato de `/assets/scan`.
3. Carga opcional del código de fabricante en los activos existentes vía importación Excel.

**Rollback:** revertir exige que no existan códigos `uid_fisico` repetidos entre tenants; si los hay, la constraint global no se puede recrear sin resolverlos primero. Mientras no haya datos productivos el riesgo es nulo, pero después de que los clientes carguen EAN el rollback deja de ser mecánico.

## Open Questions

- ¿El alta rápida debe permitir clonar también entre tenants para el Super Admin, o queda siempre dentro del tenant activo? Se implementa dentro del tenant; si aparece la necesidad, se revisa.
