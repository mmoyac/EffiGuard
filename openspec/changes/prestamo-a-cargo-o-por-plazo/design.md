## Context

`loans` guarda hoy una sola clase de entrega: unidad, operario, bodeguero, proyecto, fecha de entrega y una `fecha_devolucion_prevista` opcional. La devolución cierra el préstamo y la unidad vuelve a Disponible.

Ese modelo asume que todo lo que sale vuelve pronto. La bodega real trabaja con dos figuras: la herramienta que se presta para una faena y la herramienta que queda **a cargo** de un operario —su galletera, su huincha— hasta que renuncie, cambie de frente o se le retire. Ambas están fuera de bodega y ambas necesitan un responsable; lo que las separa es si existe una fecha en la que alguien debe reclamarlas.

Hay además un defecto acumulado: la detección de vencidos (`api/v1/dashboard.py`, líneas 236-250) filtra por `dias_max_prestamo` de variante o familia y compara contra `fecha_entrega`. Nunca lee `fecha_devolucion_prevista`. El plazo que el bodeguero pacta en el mesón se guarda y no se usa para nada salvo pintarlo en la lista de préstamos.

El sistema aún no está en producción con usuarios reales, así que la migración no tiene que preservar historia delicada.

## Goals / Non-Goals

**Goals:**

- Que el bodeguero pueda declarar en el mesón, con un gesto, si la herramienta vuelve en una fecha o queda a cargo.
- Que el panel de vencidos vuelva a ser confiable: si algo aparece ahí, hay que ir a buscarlo.
- Que el plazo pactado tenga efecto, y que no pueda pactarse por encima del límite del catálogo.
- Que lo entregado a cargo siga completamente trazado: quién la tiene, desde cuándo, y devolución con el mismo flujo de siempre.

**Non-Goals:**

- Un estado nuevo de unidad ("Asignada"). Lo entregado a cargo está En Terreno: fuera de bodega, con un responsable. Un estado aparte duplicaría toda la lógica de disponibilidad para distinguir dos situaciones que operativamente son la misma.
- Una tabla `asignaciones` separada. Sería el mismo modelo con otro nombre, y obligaría a consultar dos lugares para responder "¿dónde está esta herramienta?".
- Aprobación o flujo de autorización para entregar a cargo. Ver Decisiones.
- Revisiones periódicas de lo entregado a cargo ("confirmar cada 90 días que Pérez la sigue teniendo"). Es una funcionalidad distinta, con su propio valor y su propio costo.
- Cambiar cómo se calcula `dias_max_prestamo` ni su herencia variante → familia.

## Decisions

### Una columna `modalidad` en `loans`, no una derivación

`loans.modalidad`: `String(10)`, valores `plazo` | `a_cargo`, `NOT NULL`, default `plazo`. Sigue la convención del proyecto para enumeraciones cortas (`asset_families.comportamiento`, `codigos.tipo`): columna de texto con las constantes válidas declaradas junto al modelo, sin tipo ENUM de Postgres, que obliga a migrar el tipo para agregar un valor.

*Alternativa considerada y descartada:* derivar "a cargo" de `fecha_devolucion_prevista IS NULL`. Es gratis y es incorrecto. Hoy esa nulidad significa "no pacté fecha, rige el límite del catálogo", que es el caso más frecuente. Darle el otro significado convertiría de golpe cada préstamo corriente en una asignación indefinida y dejaría al bodeguero sin manera de decir "esto es un préstamo normal". Dos intenciones distintas no pueden compartir la misma ausencia de dato.

*Por qué `NOT NULL` con default:* la modalidad siempre existe; un préstamo sin modalidad no significa nada. El default cubre la migración y a cualquier cliente que no envíe el campo.

### La modalidad manda sobre el vencimiento, con precedencia explícita

El cálculo de vencidos queda así, en orden:

1. `modalidad = a_cargo` → **nunca vence**. Se excluye en la consulta, no en el bucle: no tiene sentido traer filas para descartarlas.
2. `fecha_devolucion_prevista` presente → vence si `ahora > fecha_devolucion_prevista`. El acuerdo del mesón manda sobre el límite del catálogo, porque el bodeguero sabía algo que el catálogo no sabe.
3. Sin fecha pactada → límite efectivo del catálogo (override de la variante → familia). Es el comportamiento actual.
4. Sin fecha y sin límite → no entra en el cálculo. Comportamiento actual.

Los campos que hoy publica el endpoint (`dias_transcurridos`, `dias_max`, `dias_excedido`) se conservan para no romper el panel; cuando el vencimiento viene de una fecha pactada, `dias_max` se expresa como los días entre entrega y fecha prevista. Se agrega `origen_plazo` (`pactado` | `catalogo`) para que el panel pueda decir por qué reclama.

*Alternativa considerada:* que el límite del catálogo siempre gane, tratando el plazo pactado como un recordatorio informativo. Se descarta porque vacía de sentido el campo que el bodeguero llena a mano, y porque el caso que motiva pactar una fecha es justamente el que el catálogo no previó.

### El plazo pactado se valida contra el techo del catálogo

Al crear un préstamo `plazo` con `fecha_devolucion_prevista`, si la unidad tiene límite efectivo (variante → familia) y los días pedidos lo superan, se rechaza con 400 y un mensaje que nombra el techo: *"El plazo máximo para esta herramienta es de N días"*.

El límite del catálogo pasa a significar lo que su nombre dice: el máximo. Hoy no significa nada en el momento de prestar y sólo aparece después, cuando el préstamo ya nació vencido y el bodeguero no entiende por qué.

*Consecuencia deliberada:* el operario que necesita la herramienta por más tiempo del que el catálogo permite tiene una salida legítima —entregarla a cargo— en vez del plazo inflado que hoy se escribe para que nadie moleste.

*Alternativa considerada:* advertir sin bloquear. Se descarta porque una advertencia que se puede ignorar en el mesón, con el operario esperando, se ignora siempre.

### El kit hereda la modalidad completa

`crear_prestamo` propaga la modalidad y el plazo a todas las piezas del kit, igual que ya propaga operario, bodeguero y proyecto. No existe la caja a cargo con el disco de corte a plazo: el kit vuelve entero o no vuelve, y ya así lo trata la devolución en bloque.

### La devolución no cambia

Se devuelve un préstamo a cargo con el mismo endpoint, la misma confirmación de quién la trae y las mismas reglas de reparación. Al cerrarse deja de existir la asignación: no queda "a cargo histórico" de nadie. Si la herramienta vuelve a salir a cargo del mismo operario, es un préstamo nuevo.

Esto es lo que hace barato el diseño: la modalidad afecta a **quién le reclama el sistema**, no al ciclo de vida del activo.

### Sin aprobación para entregar a cargo

Cualquier bodeguero que puede prestar puede entregar a cargo. Queda registrado quién lo hizo, cuándo y a quién, igual que en toda entrega.

Agregar un visto bueno significaría un estado intermedio ("pendiente de aprobación") con la herramienta en la mano del operario y el bodeguero esperando a alguien que no está en la bodega. En la práctica se resolvería prestando normal y arreglándolo después, que es peor que registrarlo bien. Si un cliente lo pide para herramientas caras, se agrega encima —por familia o por valor— sin rehacer el modelo.

### En la interfaz, dos opciones explícitas y el plazo por defecto

`ModalPrestamo` muestra dos botones táctiles de 48px: **"Por N días"** (seleccionado por defecto, con el campo de días visible y el techo del catálogo indicado) y **"A cargo"** (oculta el campo de días y muestra en su lugar la consecuencia: *"Queda a cargo de &lt;operario&gt;. No se le pedirá devolución."*).

Que el plazo sea el default es deliberado: dejar la herramienta a cargo es la decisión mayor de las dos y debe elegirse a propósito, no caer por descuido.

## Risks / Trade-offs

**"A cargo" se vuelve la salida fácil y la bodega se vacía en asignaciones que nadie revisa** → Es el riesgo real del cambio, y ninguna validación lo previene. Se mitiga dejando el plazo por defecto, exigiendo elección explícita, y manteniendo lo entregado a cargo visible y contable en las vistas de préstamos y en "En terreno": no aparece como vencido, pero no desaparece. Una vista de "herramientas a cargo por operario" es el siguiente paso natural si el volumen lo pide.

**Validar el plazo contra el catálogo puede bloquear casos legítimos** → Para eso está el modo a cargo, y el límite se corrige en el catálogo cuando está mal puesto. Se acepta el roce a cambio de que el límite signifique algo.

**El plazo pactado ahora manda y algunos préstamos existentes cambiarán de estado en el panel** → Los que tienen fecha pactada más larga que el límite dejarán de aparecer como vencidos, y los que la tienen más corta empezarán a aparecer. Es la corrección buscada, no un efecto colateral: el panel pasa a reflejar lo que se acordó.

## Migration Plan

1. Migración Alembic `029_modalidad_de_prestamo`: agrega `loans.modalidad String(10) NOT NULL DEFAULT 'plazo'`. Los préstamos existentes quedan en `plazo`, que es exactamente lo que eran.
2. Backend y frontend se despliegan juntos. Un cliente viejo que no envíe `modalidad` crea préstamos por plazo, que es el comportamiento actual.

**Rollback:** revertir el código y `DROP COLUMN modalidad`. Se pierde qué préstamos eran a cargo y vuelven a comportarse como préstamos normales —volverían a aparecer como vencidos—, sin corrupción de datos.
