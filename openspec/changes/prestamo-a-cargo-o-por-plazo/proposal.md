## Why

El bodeguero entrega herramientas de dos maneras distintas y el sistema sólo conoce una. Está el préstamo con plazo —"llévate el rotomartillo, lo necesito el viernes"— y está la entrega **a cargo**: la galletera queda con Pérez hasta nuevo aviso, él responde por ella, y nadie espera que la traiga el viernes ni ningún otro día.

Hoy toda entrega es un préstamo que se espera de vuelta. Quien recibe algo a cargo entra al mismo circuito, y el sistema lo empieza a perseguir: el cálculo de vencidos en `dashboard.py` **ignora por completo `fecha_devolucion_prevista`** y compara los días transcurridos contra el `dias_max_prestamo` de la variante o la familia. Una herramienta entregada a cargo aparece como vencida a los pocos días y su exceso crece para siempre. Con dos o tres de esas, el panel de vencidos deja de mirarse, y con él se pierde el aviso de la herramienta que sí está atrasada de verdad.

El mismo defecto tiene la otra cara: hoy el plazo que el bodeguero pacta no se respeta. Si acuerda 10 días sobre una herramienta cuya familia limita a 5, el préstamo nace vencido; si acuerda 3 sobre una que permite 30, nadie lo reclama al cuarto día. El dato se guarda y no se usa.

## What Changes

- El préstamo SHALL declarar su **modalidad de entrega**: `plazo` (vuelve en una fecha) o `a_cargo` (queda bajo la responsabilidad del operario hasta que la devuelva o se le retire).
- Un préstamo `a_cargo` NUNCA SHALL aparecer como vencido, ni en el panel del dashboard ni en las vistas de préstamos. Sigue siendo un préstamo abierto, la unidad sigue En Terreno, se devuelve con el mismo gesto de siempre. Lo que se registra es **quién responde**, no cuándo la trae.
- El cálculo de vencidos SHALL respetar el plazo pactado: si el préstamo tiene `fecha_devolucion_prevista`, esa fecha manda; sólo cuando no la tiene se recurre al `dias_max_prestamo` de la variante o su familia.
- Los días que ingresa el bodeguero SHALL validarse contra el límite del catálogo: no se puede pactar 30 días sobre una herramienta cuya familia permite 5. El límite del catálogo pasa a ser el techo del acuerdo, no un dato paralelo.
- Un kit entregado a cargo SHALL propagar la modalidad a todas sus piezas: no existe un kit medio prestado y medio asignado.
- El escaneo de una unidad entregada a cargo SHALL mostrar "A cargo de &lt;nombre&gt;" en lugar del plazo, sin días de atraso, conservando "Registrar Devolución" como acción principal.
- **Sin aprobación adicional**: cualquier bodeguero que puede prestar puede entregar a cargo. Queda registrado quién lo hizo, como en toda entrega.

## Capabilities

### New Capabilities

Ninguna. El cambio ajusta reglas de capacidades existentes.

### Modified Capabilities

- `prestamos`: la creación admite modalidad de entrega; el plazo pactado se valida contra el límite del catálogo; la detección de vencidos excluye lo entregado a cargo y respeta la fecha pactada.
- `escaneo`: el préstamo activo se muestra según su modalidad — plazo con su fecha, a cargo con su responsable.
- `dashboard`: el panel de vencidos declara de dónde sale el plazo incumplido y qué queda fuera de él.

## Impact

**Base de datos** — una columna en `loans`: `modalidad` (`plazo` | `a_cargo`), con migración Alembic `029_`. Los préstamos existentes quedan en `plazo`, que es lo que eran.

*Por qué una columna y no derivarlo de `fecha_devolucion_prevista IS NULL`*: hoy esa fecha nula significa "sin plazo explícito, aplica el del catálogo", que es el caso más común. Darle el significado de "a cargo" convertiría de golpe todos los préstamos corrientes en asignaciones indefinidas y dejaría sin forma de expresar el préstamo normal.

**Backend** — `models/loan.py`, `schemas/loan.py`, `services/prestamo.py` (validación del plazo contra el catálogo, propagación al kit), `api/v1/dashboard.py` (precedencia del plazo pactado y exclusión de lo entregado a cargo), `repositories/loan.py`.

**Frontend** — `ModalPrestamo.tsx` (elegir modalidad antes de confirmar), `Loans.tsx` y `MyLoans.tsx` (distintivo "A cargo", sin marca de vencido), `EscanearCatalogo.tsx` (ficha del préstamo activo), `types/index.ts`.

**Riesgo** — que "a cargo" se vuelva la salida fácil para no pactar plazos, y la bodega termine vaciada en asignaciones que nadie revisa. Se mitiga dejando el préstamo por plazo como opción por defecto y manteniendo lo entregado a cargo visible y contable en las vistas de préstamos: no aparece como vencido, pero no desaparece.
