## Context

El reintegro se implementó permitiendo múltiples devoluciones parciales contra un mismo despacho, con el saldo calculado como `cantidad_entregada − suma(reintegros)`. Ese diseño es correcto aritméticamente pero deja los despachos abiertos indefinidamente, porque nada declara nunca que un despacho terminó.

La operación real es más simple de lo que el modelo asumía: el operario retira material, lo ocupa y devuelve el sobrante en un solo viaje. No vuelve una semana después con más.

## Goals / Non-Goals

**Goals:**

- Que la lista de reintegro muestre sólo lo que el bodeguero puede resolver hoy.
- Que el consumo por proyecto refleje material efectivamente consumido, no olvidos acumulados.
- Que cerrar una obra sea lo que declara consumido su material, no el paso del tiempo.
- Que la irreversibilidad quede advertida antes de confirmar, no descubierta después.

**Non-Goals:**

- Un botón de "cerrar despacho" uno por uno. Es el paso extra que el diseño del reintegro quiso evitar; el reintegro y el cierre de proyecto ya cubren ambos caminos.
- Deshacer un reintegro. Sería estado nuevo para tapar un error que la confirmación previene, y el ajuste de stock ya corrige el caso raro.
- Un vencimiento por tiempo. Un despacho no caduca a los 90 días: caduca cuando la obra termina.
- Cambiar el cálculo del consumo, que sigue siendo `entregas − reintegros`.

## Decisions

### El cierre se deriva, no se almacena

Un despacho está **abierto** cuando no tiene ningún reintegro que lo referencie y su proyecto está activo (o no tiene proyecto). No se agrega columna, flag ni fecha de cierre.

Esto es posible porque el cierre **no afecta la aritmética**. El consumo de un proyecto es `entregas − reintegros` esté el despacho abierto o cerrado: si volvieron 20 de 100, el consumo es 80 en ambos casos. Lo único que el cierre determina es si el despacho se ofrece o no en la lista de reintegro. Al ser una decisión de presentación y no de contabilidad, guardarla sería agregar estado que puede desincronizarse a cambio de nada.

*Consecuencia deliberada:* reactivar un proyecto vuelve a abrir sus despachos sin reintegro. Es coherente — si la obra se retomó, el material puede volver — y es gratis por ser derivado.

*Alternativa considerada:* una columna `cerrado_at` en `inventory_logs`, escrita al reintegrar y al desactivar el proyecto. Se descarta porque exigiría migración, un backfill sobre los despachos existentes, y mantener sincronizado un dato que ya se puede responder con una consulta.

### Un reintegro por despacho

El servicio rechaza un segundo reintegro contra un despacho que ya tiene uno.

La validación de saldo existente (`cantidad ≤ saldo_pendiente`) se mantiene y sigue siendo necesaria: impide devolver más de lo que salió dentro del único reintegro permitido.

*Alternativa considerada:* permitir varios reintegros hasta agotar el saldo, y cerrar sólo cuando el saldo llega a cero. Se descarta porque en la práctica el saldo casi nunca llega a cero —el material se consume— así que el despacho quedaría abierto igual y el problema volvería.

### El cierre de proyecto es lo que declara el consumo

Desactivar un proyecto no ejecuta ninguna acción sobre sus despachos: simplemente dejan de aparecer como abiertos, porque el filtro exige proyecto activo. El endpoint de desactivación no cambia.

Es el gesto correcto porque ya existe y significa lo que queremos: terminó la obra, lo que salió y no volvió se gastó ahí.

### Los despachos sin proyecto permanecen abiertos

Un retiro sin proyecto no tiene evento de cierre salvo su propio reintegro. Se acepta esa limitación: es un caso marginal —el retiro sin imputar es la excepción, no la norma— y ponerle un vencimiento por tiempo reintroduciría el plazo arbitrario que este diseño evita. Si el volumen llegara a molestar, la salida es imputar proyecto al retirar, no inventar una caducidad.

### La confirmación precede a la irreversibilidad

El modal muestra, antes de guardar: cuánto vuelve al stock, cuánto queda como consumo y de qué proyecto, y que la entrega se cierra.

Un reintegro con la cantidad mal tecleada ya no se corrige con un segundo reintegro. Advertir la consecuencia completa en el momento es más barato que construir un deshacer, y más honesto que dejar que el usuario descubra después que la operación era final.

## Risks / Trade-offs

**Un error de tipeo cierra el despacho con la cantidad equivocada** → La confirmación previa lo previene en el caso normal. Para el resto, el ajuste de stock corrige la cantidad dejando traza del motivo, sin fabricar un reintegro que no ocurrió.

**Reactivar un proyecto reabre sus despachos** → Es el comportamiento correcto, pero significa que el conjunto de despachos abiertos no es monótono. No afecta al consumo, que se calcula igual en todo momento.

**Un despacho sin proyecto puede quedar abierto indefinidamente** → Aceptado. Ver Decisiones.

## Migration Plan

Ninguna migración de esquema ni de datos. El cambio es de reglas de consulta y validación.

Los despachos que hoy existen con reintegros parciales múltiples —si los hubiera— quedan cerrados por tener al menos un reintegro. Su consumo registrado no cambia.

**Rollback:** revertir el código. No hay datos que restaurar.
