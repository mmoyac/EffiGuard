## Context

`assets` nació como tabla única y hoy significa dos cosas distintas según la familia del activo. Para un consumible, la fila **es el producto**: lleva `stock_actual`, `stock_minimo`, `precio_compra`. Para una herramienta, la fila **es el ejemplar físico**: lleva `uid_fisico`, se presta, se devuelve, se manda a reparación. Las columnas de cada rol están nulas en el otro, y cada endpoint decide a cuál de las dos entidades le está hablando mirando `asset_families.comportamiento`.

Eso aguantó porque ninguna de las dos mitades necesitaba lo que le sobraba a la otra. Se cayó cuando apareció el caso real: tornillos idénticos comprados a tres proveedores, con tres códigos de barra. `codigo_fabricante` es una columna escalar, así que no hay dónde poner el segundo ni el tercero.

Existe además una capa a medio construir. `models` (marca + nombre) es un embrión de "producto" que hoy no lleva ni stock, ni precio, ni ubicación, y que sólo se usa como etiqueta descriptiva del activo.

La restricción que hace viable el rediseño: **EffiGuard no está en producción con usuarios reales**. No hay datos de clientes que preservar ni contratos de API que respetar.

## Goals / Non-Goals

**Goals:**

- Que un consumible tenga **un solo pozo de stock** aunque llegue de N proveedores con N códigos distintos.
- Que cualquiera de esos códigos, escaneado, resuelva al mismo lugar.
- Que cada código de empaque sepa cuántas unidades trae, porque la caja de un proveedor no trae lo mismo que la del otro.
- Que una herramienta tenga ejemplares individuales, prestables por separado, agrupados bajo un mismo modelo para poder preguntar "¿cuántos taladros libres quedan?".
- Que la distinción prestable/consumible siga viniendo de la familia y no se convierta en dos esquemas paralelos con las mismas columnas duplicadas.
- Que los atributos que distinguen una variante de otra (medida, material) dejen de ser texto libre dentro del nombre.

**Non-Goals:**

- **Lotes y vencimiento.** Una partida recibida con su fecha de vencimiento es otra entidad, que cuelga de la variante sin alterar nada de este diseño. Se deja para cuando aparezca el caso (siliconas, adhesivos, EPP con fecha).
- **Compras y precios por proveedor.** Este cambio registra *de quién viene un código*, no *a cuánto me lo vende cada uno* ni órdenes de compra. El costo de cada movimiento ya lo congela `inventory_logs.costo_unitario`.
- **Costeo por lote o FIFO/LIFO.** El pozo único de stock implica costo promedio, que es lo que el modelo actual ya asume.
- **Reservas o comprometido.** El stock es lo que hay, no lo que quedará.
- **Compatibilidad hacia atrás de la API.** No hay clientes externos versionados salvo n8n, que se reapunta como parte del trabajo.

## Decisions

### Tres niveles, no dos

`productos` → `variantes` → `unidades`.

- **`productos`** es el bien conceptual: "Tornillo autoperforante", "Taladro percutor GSB-13RE". Agrupa, describe, cuelga de una familia y de una marca opcional. **No tiene stock ni precio** — un producto no es comprable, lo comprable es una variante suya.
- **`variantes`** es el SKU: "6x40 zincado". Es **la** unidad de stock, de precio, de stock mínimo y de código de barras. Todo lo operativo vive acá.
- **`unidades`** es el ejemplar físico, con su identificador propio. Sólo existe para familias `prestable`.

*Alternativa considerada:* dos niveles (variante → unidad), dejando que `models` siga siendo el agrupador. Se descarta porque `models` no tiene familia ni ubicación ni nada operativo, así que igual habría que engordarlo hasta convertirlo en `productos` — y a mitad de camino quedaría un modelo donde no se sabe si la marca vive arriba o abajo.

*Alternativa considerada:* un nivel único con los códigos en tabla aparte (el parche mínimo). Resuelve el escaneo pero deja `assets` con la doble personalidad intacta, y no permite "todos los tornillos autoperforantes" ni "3 de 7 taladros disponibles". Es media solución con el mismo costo de migración.

### La variante es el único pozo de stock; el proveedor no lo parte

Un código de proveedor **etiqueta** una variante, no la subdivide. Los tornillos de Sodimac y los de Construmart son la misma fila de `variantes` y el mismo `stock_actual`.

Es la decisión central del cambio. Si cada proveedor tuviera su propio stock, "tengo 500 tornillos" pasaría a ser "180 + 220 + 100" y cada despacho obligaría al bodeguero a elegir de cuál descontar, cuando al maestro que los va a usar le da exactamente lo mismo. Peor: el stock mínimo dejaría de funcionar, porque tres posiciones bajo el mínimo con material de sobra en total dispararían tres alertas falsas.

Lo que sí distingue de verdad —6x40 contra 8x60, zincado contra inoxidable— **son** variantes separadas, porque no son intercambiables en la obra. El criterio de corte es ése: *¿el que lo va a usar nota la diferencia?* Si no la nota, es la misma variante con otro código.

*Consecuencia aceptada:* el costo unitario es un promedio entre proveedores. Es correcto para materiales fungibles y ya es lo que hace el modelo actual.

### Una sola tabla `codigos` para todo lo escaneable

Una tabla, no dos: `codigos` con `variante_id` y `unidad_id`, exactamente uno de los dos no nulo (CHECK), y `UNIQUE (tenant_id, codigo)`.

```
codigos
  tenant_id, codigo            → UNIQUE juntos
  variante_id | unidad_id      → CHECK: exactamente uno
  tipo        fabricante | proveedor | empaque | propio | serie_fabrica
  proveedor_id                 → nullable
  factor      Numeric(12,3)    → default 1
  nombre_empaque               → "caja", "rollo"; nullable
  es_principal boolean         → índice único parcial por dueño
```

Tres razones para unificar en vez de tener `variante_codigos` + `unidades.uid_fisico`:

1. **Las herramientas también necesitan varios códigos.** El QR que pega el bodeguero y el número de serie de fábrica son dos códigos del mismo taladro, y ambos se van a escanear. Con `uid_fisico` escalar habría que construir la misma funcionalidad dos veces.
2. **El escaneo es una consulta.** Sin tabla única habría que buscar en `unidades` y después en `variante_codigos`, con una regla de precedencia inventada para el caso de choque.
3. **La unicidad la garantiza una restricción**, no la disciplina de la aplicación. Con dos tablas, nada impide que un EAN de proveedor coincida con un UID autogenerado.

`es_principal` marca el código que se muestra en listados y se imprime en la etiqueta, con índice único parcial por dueño para que no haya dos. Se reemplaza así a `uid_fisico` sin dejar dos fuentes de verdad.

### El tipo del código decide de qué nivel cuelga

Un EAN13 de fábrica identifica el **modelo**, no el ejemplar: los tres esmeriles GWS-850 de la bodega traen impreso el mismo número. Si ese código colgara de la unidad habría que repetirlo tres veces, y `UNIQUE (tenant_id, codigo)` lo rechazaría al segundo intento — correctamente, porque el dato estaría mal puesto.

De ahí la regla, que el tipo ya expresa sin necesidad de un campo extra:

| Tipo | Responde | Cuelga de |
|---|---|---|
| `fabricante` | ¿qué modelo es? | variante |
| `proveedor` | ¿con qué número me lo vende éste? | variante |
| `empaque` | ¿cuántas trae esta caja? | variante |
| `serie_fabrica` | ¿cuál ejemplar es? | unidad |
| `propio` | el código que asigné yo | cualquiera |

`propio` es el único ambiguo a propósito: sirve tanto para la etiqueta que se pega a un taladro como para el código interno de un pozo de tornillos, y en ambos casos el nivel lo da el contexto de quien lo crea.

La consecuencia operativa es deseable: escanear el EAN de la caja de un esmeril resuelve a la **variante** y responde "2 de 3 disponibles, elige cuál prestar" — que es exactamente lo que el bodeguero necesita cuando tiene la caja en la mano y no el ejemplar. Escanear el QR pegado al esmeril resuelve a **esa** unidad. Dos gestos distintos, dos respuestas correctas.

*Alternativa considerada:* no clasificar el tipo por nivel y dejar que cualquiera cuelgue de cualquier cosa. Se descarta porque el error que evita es silencioso: un EAN cargado en la primera unidad "funciona" hasta que llega la segunda del mismo modelo, y para entonces ya hay datos que corregir.

*Costo aceptado:* `factor` y `nombre_empaque` no significan nada en un código de unidad, y quedan en su valor por defecto. Es más barato que partir la tabla en dos por dos columnas.

### El factor vive en el código, no en la variante

`contenido_por_empaque` desaparece de la variante. Cada código de tipo `empaque` lleva su propio `factor`: el código de la caja de Sodimac trae 100, el de la caja de Construmart trae 250, y el código suelto trae 1.

Ésa es la corrección directa del defecto que hoy tiene `assets.contenido_por_empaque`, que sólo admite un empaque por producto. Escanear el código en una compra ya no requiere preguntar cuántas unidades trae: el código lo sabe.

El stock sigue guardándose **siempre en la unidad de despacho**, como decidió `compra-por-empaque`. El factor sólo traduce al ingresar.

### El stock de las herramientas es derivado, nunca almacenado

Para una variante consumible, `stock_actual` es una columna. Para una variante prestable, el stock **no se guarda**: es `COUNT(unidades WHERE estado_id = 1)`.

Guardarlo obligaría a mantenerlo sincronizado en cada préstamo, devolución, reparación, pérdida y alta de unidad — cinco caminos para que se descuadre contra la verdad, que son las filas de `unidades`. Un contador que puede mentir sobre datos que están al lado no vale lo que ahorra.

La API expone `stock_disponible` unificado, y para prestables agrega `unidades_total` y `unidades_disponibles` ("3 de 7 disponibles").

`stock_minimo` sí aplica a ambos: "quiero al menos 2 taladros libres" es una alerta tan válida como "al menos 500 tornillos". La comparación usa el stock efectivo, venga de la columna o del conteo, y así la alerta de quiebre queda unificada.

### Los atributos son JSONB en la variante, con el nombre aparte

`variantes.atributos` (`JSONB`, índice GIN) guarda `{"medida": "6x40", "material": "zincado"}`.

No pueden ser columnas fijas: los atributos que importan dependen del rubro del tenant —diámetro y largo para una constructora, amperaje y voltaje para una eléctrica— y adivinarlos sería equivocarse. Tampoco EAV (`variante_atributos` con filas nombre/valor): triplica las filas y obliga a un pivote en cada listado, a cambio de una consultabilidad que JSONB con GIN ya da.

Para que las claves no degeneren en caos, la interfaz ofrece como autocompletado las claves ya usadas en otras variantes del **mismo producto**. Es una restricción blanda, sin tabla de definición que mantener.

`variantes.nombre` sigue siendo texto obligatorio y escrito a mano ("6x40 zincado"). No se deriva de los atributos: la concatenación automática produce "6x40 / zincado / DIN-7504", que no es como nadie nombra un tornillo. Los atributos sirven para filtrar y comparar; el nombre, para leer.

### La bitácora referencia la variante siempre y la unidad cuando la hay

`inventory_logs.variante_id` no nulo, `unidad_id` nullable.

Toda posición de stock que se mueve es una variante, así que el consumo por proyecto y la valorización se calculan igual para herramientas y consumibles, sin ramificar la consulta. La unidad se agrega cuando el movimiento identifica un ejemplar concreto: entrega, devolución, reparación, pérdida de una herramienta.

Se suma `codigo_id` (nullable, `ON DELETE SET NULL`) para dejar constancia del código escaneado en una compra. Es lo que permite auditar contra la factura del proveedor: de quién vino y en qué empaque. Borrar el código después no invalida el movimiento, sólo pierde esa referencia.

### El proveedor de una compra se deduce, no se tipea

`inventory_logs.proveedor_id` (nullable, `ON DELETE SET NULL`) se llena solo cuando la compra trae un `codigo_id`: el código ya sabe de quién es.

El bodeguero opera con guantes en un mesón. Cada campo que hay que elegir a mano es un campo que se llena mal o se salta, así que la regla es que el dato salga del gesto que ya está haciendo —escanear la caja— y no de un formulario extra.

El problema aparece en la compra tipeada a mano, que no tiene código y por lo tanto no tendría proveedor. Eso produce un dato asimétrico: las compras escaneadas saben de dónde vienen y las manuales no, y cualquier reporte construido encima queda incompleto sin avisar, que es peor que no tener el dato. Para cerrar esa brecha sin agregar fricción, el formulario ofrece como selección rápida **los proveedores que esa variante ya conoce** —los de sus propios códigos—, que en la práctica son dos o tres. El campo sigue siendo opcional: una compra sin proveedor se registra igual.

*Alternativa considerada:* hacer el proveedor obligatorio en toda compra. Se descarta porque convierte un dato de apoyo en un bloqueo operativo, y la salida previsible del bodeguero apurado sería elegir siempre el primero de la lista — que es exactamente cómo se ensucian los datos.

*Frontera con el Non-Goal:* registrar **de quién vino esta compra** es una columna nullable y va en este cambio. **Cuánto cobra cada proveedor, comparativas y órdenes de compra** siguen fuera.

### El Excel es para arrancar; el día a día es la interfaz

La carga masiva existe para el onboarding: un cliente que entra con doscientos productos y quinientas herramientas no los tipea. Pasado ese momento, **todo lo nuevo se hace desde la interfaz** — crear un producto, corregir un precio, dar de baja algo cargado por error.

Eso fija un estándar para la UI: tiene que cubrir el ciclo completo por su cuenta. Si falta la edición, la única salida para arreglar una letra es reimportar una planilla, y ahí pasan dos cosas conocidas: nadie lo hace, y el que lo hace arrastra de vuelta datos viejos en las demás columnas.

También explica por qué la reimportación tiene que ser inofensiva aunque ya no sea el camino principal: quien vuelva al Excel meses después lo hará justamente en el escenario en que más daño podría hacer, con el catálogo lleno.

*Alternativa considerada:* mantener el Excel como vía equivalente y permanente, con la UI cubriendo sólo lo frecuente. Se descarta porque obliga a mantener dos caminos completos y sincronizados para cada campo nuevo, y porque la planilla no puede validar contra el estado real —no sabe que esa variante tiene stock— así que las reglas terminarían duplicadas y divergiendo.

### El Excel mantiene el catálogo; el inventario sólo se mueve por movimientos

La importación no escribe `stock_actual` sobre una variante existente. Un stock declarado se traduce siempre en una fila de `inventory_logs`: un log de apertura al crear la variante, un `ajuste` cuando difiere del stock vigente, y nada cuando la celda viene vacía.

El template está pensado para uso recurrente —se descarga el catálogo, se edita, se reimporta—, y ahí una escritura directa de stock es un bug silencioso sobre el dato que el sistema existe para custodiar: alguien baja la planilla el lunes para corregir nombres, la sube el viernes, y devuelve el stock al valor del lunes sin que la bitácora muestre nada. Pasar por el mismo camino que el endpoint `adjust` cuesta lo mismo y deja traza.

Por la misma razón, `cantidad_unidades` sólo aplica cuando la fila **crea** la variante. Si se reaplicara en cada reimportación, cargar 200 taladros dos veces dejaría 400. Dar de alta más ejemplares es una operación de recepción con su fecha y su etiqueta impresa, no algo que se deduzca de que un número subió en una planilla.

Y el template descargado viene con `stock_actual` y `cantidad_unidades` **vacías**: si el dato no está, no hay forma de pisarlo por accidente. Quien quiera usarlas para una carga inicial las escribe a mano.

*Alternativa considerada:* ignorar `stock_actual` en las actualizaciones. Es seguro pero inútil para el caso legítimo —cuadrar el inventario después de un conteo físico—, que es justamente cuando una planilla es la herramienta correcta. Convertirlo en `ajuste` con log da las dos cosas.

### Las herramientas se cargan por Excel de dos maneras

Un tenant que entra con 200 herramientas necesita cargarlas sin crear 200 unidades a mano, que sería pedir trabajo manual en el peor momento posible: el onboarding.

- **Sin etiquetar:** una columna `cantidad_unidades` en la fila de la variante crea N unidades con UID autogenerado, listas para imprimir.
- **Ya etiquetadas:** una fila por ejemplar, todas con el mismo `producto` y `variante`, cada una con su código en la columna `codigos`. La clave de upsert de las filas prestables pasa a ser la terna (`producto`, `variante`, primer código).

Las dos vías son excluyentes en una misma fila, y declarar ambas es un error de validación en vez de una precedencia adivinada.

### Los kits se arman entre unidades

`parent_asset_id` pasa a `unidades.parent_unidad_id`. Un kit es un conjunto de ejemplares físicos que se prestan juntos —una caja de herramientas concreta, no "la idea de caja de herramientas"—, así que la jerarquía pertenece al nivel de la unidad.

Los consumibles no arman kits. Eso hoy es posible por accidente del modelo único y no responde a ningún caso real.

### La ubicación se resuelve por nivel, con precedencia

`ubicacion_id` existe en `variantes` y en `unidades`.

Un consumible ocupa una posición: el pozo de tornillos está en un rack. Las herramientas no: dos taladros del mismo modelo pueden estar en racks distintos, así que ahí manda la unidad.

Regla: **la ubicación de la unidad gana; si es nula, se hereda la de la variante**. Es el mismo patrón de precedencia que ya usa `dias_max_prestamo` con la familia, así que no introduce un concepto nuevo.

### Los proveedores son catálogo por tenant, sin lógica

`proveedores`: `tenant_id`, `nombre`, `rut` opcional, `contacto` opcional. Nada más.

Existe para que un código pueda decir de quién viene, en vez de guardar "Sodimac" como texto repetido en cada fila. No lleva precios ni condiciones: eso es compras, y compras no está en este cambio.

## Risks / Trade-offs

**Es el cambio más invasivo hecho al esquema, y toca casi todo el backend de dominio** → Se mitiga con el orden de las tareas: primero modelos y migración, después repositorios, después servicios, y recién al final los routers y el frontend. Cada capa queda verificable antes de que la siguiente dependa de ella. Sin usuarios en producción, un backend a medio migrar no le rompe el día a nadie.

**El refactor puede convertirse en la excusa para agregar lotes, compras y costeo avanzado** → Los Non-Goals están escritos justamente para eso. El modelo deja lugar para los tres sin rediseño: los lotes cuelgan de la variante, las compras de los proveedores.

**Migrar dos entidades en una obliga a decidir, activo por activo, si era producto o unidad** → No hay que decidirlo: la familia ya lo dice. Un activo de familia consumible se convierte en producto + variante; uno prestable en producto + variante + una unidad. La regla es mecánica y la aplica el script de resiembra.

**`es_principal` puede quedar sin ninguna fila marcada** si se borra ese código → El índice único parcial impide *dos* principales, no *cero*. El servicio marca automáticamente como principal el primer código de un dueño, y al borrar el principal promueve al más antiguo de los restantes. Se resuelve en el servicio porque una restricción de "al menos uno" en SQL exigiría diferir constraints en cada alta.

**JSONB sin esquema permite que dos variantes del mismo producto usen `medida` y `Medida`** → El autocompletado por producto lo evita en la práctica. Es una restricción blanda a propósito: la alternativa rígida es una tabla de definición de atributos por tenant, que es mantención que nadie va a hacer.

**`valor-de-bodega` está en vuelo y calcula sobre `assets`** → Conviene terminarlo y archivarlo antes de empezar éste. Si no, su cálculo se reapunta a `variantes` dentro de este trabajo y se archiva después, pero no deberían avanzar en paralelo sobre las mismas tablas.

## Migration Plan

1. **Una sola migración Alembic**, destructiva: crea `productos`, `variantes`, `codigos`, `unidades`, `proveedores`; reapunta `loans.unidad_id` e `inventory_logs.variante_id`/`unidad_id`/`codigo_id`; elimina `assets` y `models`.
2. **Sin backfill.** No hay datos de clientes. Los entornos de desarrollo se rehacen desde el seed.
3. **Seed actualizado** para sembrar la nueva jerarquía, incluyendo un consumible de ejemplo con dos códigos de proveedor y un empaque, que es el caso que motivó el cambio y conviene tener a mano para probar.
4. **n8n se reapunta** después de desplegar: `GET /api/v1/assets/query` cambia de forma y el agente lo consulta.

**Rollback:** `alembic downgrade` recrea el esquema anterior vacío. La recuperación real es revertir el commit y resembrar. No hay datos productivos en juego — es exactamente la ventana que hace barato este cambio.

## Open Questions

Ninguna pendiente. Las dos que quedaban se resolvieron y están recogidas arriba como decisiones:

### El alta crea producto y variante en un solo formulario

La mayoría de los consumibles no tiene variantes reales —un tarro de silicona es un tarro de silicona—, así que exigir dos pasos cobraría el costo del modelo en el caso más común sin dar nada a cambio.

El formulario de alta pide los datos operativos (nombre, familia, unidad, stock mínimo) y crea **producto + una variante homónima** en la misma operación. Declarar variantes es una sección plegada y opcional; si más adelante aparece otra medida, se agrega al producto que ya existe.

El modelo no cambia por esto: la variante implícita es una fila normal. Es sólo la interfaz la que evita mostrar dos niveles a quien no los necesita.

### Las unidades se dan de alta por cantidad, con UID autogenerado

Recibir 10 taladros iguales crea 10 filas de `unidades` en una operación, cada una con su código principal autogenerado en formato `EFG-XXXXXXXX` —el mismo que ya usa la importación Excel— listo para imprimir como etiqueta.

Se descartó exigir un escaneo por ejemplar: es lento con volumen y presupone que el ejemplar ya viene identificado, cosa que no pasa con herramienta nueva sin etiquetar. El código de fábrica no se pierde si existe: se agrega después como un código adicional de tipo `serie_fabrica`, que es justo lo que permite tener varios códigos por unidad.
