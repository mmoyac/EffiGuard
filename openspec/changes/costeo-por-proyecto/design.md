## Context

Los movimientos que hacen falta para costear el material ya existen: `inventory_logs` guarda cantidad, tipo de movimiento y proyecto. Lo que falta es el precio y la regla que los cruza.

Hay un campo relacionado pero distinto: `assets.valor_reposicion`, que es cuánto cuesta reponer el activo si se pierde. No es precio de compra, y se mantiene con su significado actual.

Este cambio se acotó deliberadamente al material. Una versión anterior incluía tarifa diaria de herramientas, y de ahí surgió mano de obra, fletes y margen por orden de trabajo — que es costeo de órdenes y no gestión de bodega. Ese alcance quedó documentado aparte y fuera de este cambio.

## Goals / Non-Goals

**Goals:**

- Responder cuánto costó el material que consumió un proyecto.
- Expresar las pérdidas en pesos, que es lo que obliga a explicarlas.
- Que un proyecto costeado hoy valga lo mismo dentro de seis meses, aunque el precio del material haya cambiado.
- Que la ausencia de precio no rompa nada ni se disfrace de cero.

**Non-Goals:**

- Costo de uso de herramientas, mano de obra, fletes y margen. Ver `openspec/notas/costeo-de-ordenes.md`.
- Valorización por lotes (FIFO/LIFO). Requiere trazabilidad de lote que el sistema no tiene ni necesita.
- Costo promedio ponderado móvil. Ver Decisiones.
- Presupuesto y comparación real contra presupuestado.

## Decisions

### El costo se congela en el movimiento, no se recalcula desde el activo

`inventory_logs` incorpora `costo_unitario`, que se escribe con el precio vigente del activo en el instante del movimiento. El costo de un movimiento es `cantidad × costo_unitario`.

Es la decisión central. Si el costo se calculara multiplicando la cantidad histórica por el precio actual del activo, subir el precio del tornillo mañana cambiaría retroactivamente lo que costó un proyecto terminado el año pasado. Un informe de costos que cambia solo no sirve para nada.

*Precisión:* `Numeric(12,4)` y no `(12,2)`, porque el costo unitario de un consumible barato es una fracción —una caja de 100 tornillos a $12.000 da $120, pero un rollo de 7 metros a $12.000 da $1.714,2857— y redondear en el unitario arrastra error al multiplicar por cantidades grandes. La presentación redondea; el almacenamiento no.

*Alternativa considerada:* costo promedio ponderado móvil, recalculando un promedio en el activo con cada compra. Es la norma contable y sería más exacto cuando el precio fluctúa dentro de un mismo stock. Se descarta porque exige un campo de promedio que hay que mantener sincronizado con cada entrada, y el congelamiento ya resuelve el problema que importa: que la historia no se mueva. Migrar después es directo, porque el punto de escritura del costo es uno solo.

### El precio de compra se guarda por unidad de stock, no por empaque

`assets.precio_compra` es el costo de **una unidad de stock**: un tornillo, un metro de cable.

Va en la misma unidad que el stock por la misma razón que el stock vive en la unidad de despacho: es la unidad en que ocurren los movimientos que hay que valorizar. Guardar el precio de la caja obligaría a dividir en cada cálculo y a decidir qué pasa cuando el contenido del empaque cambia.

La fricción de ingreso —el proveedor factura por caja— se resuelve en el formulario, que acepta el precio del empaque y lo divide por `contenido_por_empaque`, igual que la compra acepta cajas y guarda unidades.

### Las pérdidas de herramienta se valorizan a valor de reposición

Una herramienta robada no tiene precio de compra unitario: lo que cuesta es reemplazarla. Para consumibles perdidos se usa el costo unitario congelado, que es lo que efectivamente se pagó por ellos.

Es la distinción correcta: el consumible perdido es dinero ya gastado; la herramienta robada es dinero que hay que volver a gastar.

Nótese que esto sí es prevención de robos y no contabilidad de gestión: es el único costo de herramienta que este cambio calcula, y existe porque un robo en pesos se explica y uno en unidades no.

### Tres líneas separadas, nunca una suma

El costo de material de un proyecto se reporta como consumo, pérdidas y mermas por separado.

Sumarlas escondería exactamente lo que el sistema existe para exponer: si el robo se diluye dentro del consumo, nadie lo ve. La merma es desperdicio operativo y el robo es un problema de control; son naturalezas distintas y se leen distinto.

### Lo no valorizado se reporta, no se cuenta como cero

Los movimientos sin `costo_unitario` —los anteriores a este cambio, o los de activos sin precio configurado— se informan como cantidad de movimientos sin valorizar junto a cada total.

Un total que suma en silencio los movimientos sin precio como cero es un total mentiroso, y peor que no tener el dato: transmite una precisión que no existe.

## Risks / Trade-offs

**Configurar el precio después de que hubo movimientos deja esos movimientos sin costo** → Es correcto: no se sabía el precio cuando ocurrieron, e inventarlo hacia atrás sería falsear la historia. Se reportan como no valorizados para que la brecha sea visible.

**El costo unitario congelado no refleja fluctuación dentro de un mismo stock** → Si se compró a $100 y luego a $150, los movimientos posteriores usan $150 aunque queden unidades compradas a $100. Es el trade-off de no llevar promedio ponderado, y el error es acotado mientras las compras sean regulares.

**El costo por proyecto queda incompleto a propósito** → No incluye mano de obra ni herramientas, así que no responde "cuánto costó el trabajo". La interfaz debe titularlo como costo de materiales y no como costo del proyecto, para no sugerir una completitud que no tiene.

## Migration Plan

1. Migración Alembic que agrega las dos columnas, ambas nulas y sin backfill.
2. Carga de precios por Excel o desde el formulario de activo.
3. Los movimientos anteriores quedan sin costo y se reportan como no valorizados.

**Rollback:** eliminar ambas columnas. Se pierde la configuración de precios y los costos congelados; ningún dato de inventario se ve afectado.
