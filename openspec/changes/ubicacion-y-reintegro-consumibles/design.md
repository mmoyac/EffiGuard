## Context

EffiGuard modela hoy el stock de consumibles como un entero que sólo baja (`entrega`, `merma`, `perdida`) o sube sin origen (`compra`, `ajuste`). No existe el concepto de "material despachado que vuelve", ni el de "dónde está guardado esto".

Dos hechos del código actual condicionan el diseño:

- `assets.stock_actual`, `assets.stock_minimo` e `inventory_logs.cantidad` son `Integer`. Un despacho de 100 metros de cable se puede registrar, pero un reintegro de 12,5 metros no.
- `inventory_logs` ya guarda `project_id` y `operario_id` en los retiros de consumible, así que la imputación por proyecto existe; lo que falta es poder descontar de ella lo que regresó.

El sistema aún no tiene usuarios en producción, lo que permite cambiar tipos de columna sin ventana de mantención ni migración de datos en caliente.

## Goals / Non-Goals

**Goals:**

- Que el bodeguero registre y consulte la ubicación física de cualquier activo en segundos, con guantes y desde el teléfono.
- Que el asistente de n8n pueda responder dónde está algo, no sólo si hay.
- Que el material sobrante vuelva al stock sin ensuciar el indicador de pérdidas.
- Que el consumo real por proyecto sea calculable: despachado menos reintegrado.
- Que las cantidades soporten medidas continuas (metros, kilos, litros) con su unidad visible.

**Non-Goals:**

- Un catálogo normalizado de ubicaciones con mantención propia. Se descarta en esta etapa (ver Decisiones).
- Control de lote, vencimiento o número de serie de consumibles.
- Costeo del consumo por proyecto. Se habilita el dato base (consumo neto), no el reporte valorizado.
- Reintegro de herramientas prestables: eso ya es la devolución de préstamo y no cambia.
- Ubicación con historial de movimientos entre racks. Se guarda la ubicación actual, no su bitácora.

## Decisions

### Ubicación como catálogo por tenant, con creación inline

Se crea la tabla `ubicaciones` por tenant, donde cada fila es una posición real de la bodega: `rack`, `nivel`, `posicion` (todos `varchar(20)`) más `descripcion` opcional, con `UNIQUE (tenant_id, rack, nivel, posicion)`. `assets` apunta con `ubicacion_id` nulo.

Los tres campos son texto y no entero porque las bodegas rotulan racks como "A", "B1" o "PASILLO-2". Se guardan con `trim` y en mayúsculas, de modo que "a1" y "A1" sean la misma fila y la constraint única los colapse.

**Una sola tabla y no tres catálogos independientes.** "Nivel 5" no existe con independencia del rack: un catálogo de niveles separado permitiría componer combinaciones que no existen físicamente. Con una fila por posición real, los selectores en cascada se derivan por consulta —racks distintos del tenant, luego niveles de ese rack, luego posiciones de ese nivel— y la interfaz muestra tres desplegables sin necesidad de tres tablas.

**La fricción del catálogo se resuelve con creación inline.** La objeción a un catálogo es que obliga a darlo de alta antes de poder usarlo, y el bodeguero está guardando una caja, no configurando el sistema. Por eso el selector incluye "Crear ubicación nueva" en el mismo formulario del activo: escribe rack, nivel y posición, se crea la fila y queda seleccionada, sin navegar a otra pantalla. El catálogo se llena solo con el uso, y aun así queda normalizado.

*Alternativa considerada:* tres campos de texto libre en el activo, sin catálogo. Menos código y cero mantención previa, pero admite que "R3" y "RACK 3" convivan como ubicaciones distintas, no permite renombrar un rack completo de una vez, y obliga a tipear tres campos por activo con guantes. Se descarta: el volumen esperado es de decenas de activos ubicados por sesión, donde elegir de una lista vence a escribir.

*Alternativa considerada:* catálogo sólo de racks, con nivel y posición como texto libre. Punto medio que deja sin control justamente los dos campos más repetitivos de tipear.

**Renombrar es una operación sobre el catálogo.** Cambiar "RACK 3" por "RACK A" es un `UPDATE` de una fila y todos los activos quedan reubicados, que es lo que un catálogo compra y el texto libre no.

### Cantidades en `Numeric(12,3)`

`stock_actual`, `stock_minimo` y `inventory_logs.cantidad` pasan a `Numeric(12,3)`.

Tres decimales cubren gramos sobre kilos y milímetros sobre metros, que es el grano operativo de una bodega industrial. Se usa `Numeric` y no `Float` porque el stock es una cantidad contable: sumar y restar en punto flotante acumula error y termina dejando saldos como `79.99999999`.

*Serialización:* Pydantic v2 serializa `Decimal` como string en JSON. Eso rompería al frontend, que compara `stock_actual <= stock_minimo`, y al workflow de n8n. Por eso los schemas de respuesta serializan estos campos explícitamente como número JSON, manteniendo `Decimal` en la capa de servicio, donde ocurre la aritmética.

### Unidad de medida en el activo, no en la familia

`assets.unidad` acepta `unidad`, `metro`, `kilo` o `litro`, con `unidad` por defecto.

Va en el activo porque una misma familia mezcla naturalezas: la familia sembrada por defecto "Consumible" contiene tanto guantes (que se cuentan) como cinta aisladora (que se mide). Ponerla en la familia obligaría a fragmentar el catálogo del cliente sólo para expresar la unidad.

### El reintegro referencia el despacho de origen

`inventory_logs` incorpora `origen_log_id`, FK autorreferencial nula. Un movimiento `reintegro` la usa para apuntar al movimiento `entrega` del que vuelve el material, y hereda de él el `project_id` y el `operario_id`.

Con eso el saldo pendiente de un despacho es `cantidad_entregada - SUM(reintegros que lo referencian)`, y el consumo neto de un proyecto es la suma de esos saldos. Se calcula al vuelo con una agregación en vez de guardarse en una columna `cantidad_reintegrada`: el volumen de movimientos por despacho es bajo, y un valor derivado almacenado es un estado más que puede quedar desincronizado.

*Alternativa considerada:* reintegro suelto que sólo suma stock e imputa proyecto. Se descarta porque sin vínculo no hay forma de impedir que se reintegren 500 metros de algo de lo que salieron 100, y el consumo por proyecto queda sin control.

### El reintegro es un movimiento propio, no una variante de otro

Se agrega el tipo `reintegro` al vocabulario de `tipo_movimiento`, junto a los ocho existentes. No se reutiliza `ajuste` (que fija un valor absoluto y no tiene origen) ni `compra` (que implica ingreso de material nuevo, no retorno). Mantenerlo separado es lo que permite distinguir en la bitácora lo que volvió de obra de lo que se compró.

### Validaciones del reintegro

- Sólo sobre movimientos `entrega` de activos cuya familia es `consumible`.
- La cantidad debe ser mayor a cero y no puede superar el saldo pendiente del despacho.
- El despacho referenciado debe pertenecer al mismo tenant y al mismo activo.

Cuando vuelve material de un despacho que no se puede identificar —por ejemplo, sobrantes anteriores a este cambio— la salida es el `ajuste` que ya existe, que sube el stock dejando constancia del motivo.

### Las columnas nuevas del Excel se agregan al final

El importador lee las celdas por índice y devuelve `None` para índices fuera de rango. Agregando `ubicacion_rack`, `ubicacion_nivel`, `ubicacion_posicion` y `unidad` al final de `_COLUMNS`, los archivos generados con el template anterior siguen importándose sin error. Insertar columnas en medio rompería silenciosamente cualquier archivo viejo, así que el orden existente no se toca.

El Excel sigue trabajando con las tres columnas de texto y no con el `ubicacion_id`, porque nadie edita una planilla poniendo IDs. El importador resuelve la terna contra el catálogo y, si no existe, **crea la ubicación en vez de rechazar la fila**: es el mismo criterio de la creación inline del formulario. Para que ese crecimiento no pase inadvertido, la respuesta de importación informa cuántas ubicaciones nuevas se crearon, lo que además delata errores de tipeo masivos en el archivo. Se aparta deliberadamente del trato que reciben `familia` y `estado`, que sí rechazan la fila: esos son configuración con significado de negocio, una ubicación es sólo una etiqueta de dónde está algo.

### El reintegro entra por el escáner

Al escanear un consumible, junto a la acción principal "Retirar Consumible" aparece una acción secundaria "Reintegrar sobrante", habilitada sólo si ese consumible tiene despachos con saldo pendiente. El modal lista esos despachos (proyecto, operario, fecha, saldo) para que el bodeguero elija contra cuál devuelve. Es el mismo patrón de las acciones secundarias que ya existen para pérdida y merma.

## Risks / Trade-offs

**El cambio de entero a decimal altera el contrato de la API** → El workflow de n8n que formatea las respuestas de `/assets/query` debe revisarse junto con el despliegue. Al no haber usuarios en producción, no hay clientes móviles con versiones antiguas que puedan romperse.

**La creación inline puede llenar el catálogo de ubicaciones basura** si el bodeguero crea una nueva en vez de buscar la existente → Se mitiga con la normalización a mayúsculas y la constraint única, que colapsan las variantes de tipeo evidentes, y con que el selector muestre primero las ubicaciones ya existentes y deje "crear nueva" como acción secundaria. La pantalla de mantención permite fusionar o corregir después.

**Borrar una ubicación en uso dejaría activos sin ubicar** → La eliminación se bloquea mientras tenga activos asignados, con el mismo criterio que ya usa la eliminación de familias.

**El saldo pendiente calculado en cada consulta agrega una agregación por despacho** → Aceptable con el volumen actual. Si la bitácora crece, el camino es un índice sobre `origen_log_id` (que se crea desde ya) y, sólo si hiciera falta, una vista materializada.

**Un despacho puede quedar con saldo pendiente para siempre** si nadie reintegra ni informa que se consumió todo → El saldo pendiente es informativo, no bloquea nada. No se agrega un cierre explícito de despacho en esta etapa para no sumar un paso más al flujo del bodeguero.

**`ALTER COLUMN ... TYPE numeric` reescribe la tabla y la bloquea** → Irrelevante con el tamaño actual y sin tráfico productivo.

## Migration Plan

1. Migración Alembic única que crea la tabla `ubicaciones` con su constraint única, agrega `ubicacion_id` y `unidad` en `assets`, agrega `origen_log_id` con su índice en `inventory_logs`, y convierte los tres campos numéricos con `USING columna::numeric(12,3)`.
2. Migración de seeds que agrega el `menu_item` de mantención de ubicaciones y sus permisos para los roles admin y bodeguero, siguiendo el patrón de los seeds existentes.
3. Despliegue de backend y frontend juntos: el frontend nuevo espera los campos nuevos, y el backend nuevo serializa decimales.
4. Revisión del workflow de n8n que consume `/assets/query`.

**Rollback:** revertir la migración devuelve los tipos a `Integer` con `USING ROUND(columna)`, lo que pierde los decimales registrados, y elimina la tabla `ubicaciones` y las columnas nuevas junto con los movimientos `reintegro` que dependan de `origen_log_id`. Es un rollback destructivo, aceptable sólo mientras no haya datos productivos.
