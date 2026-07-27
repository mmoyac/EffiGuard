# Costeo de órdenes de trabajo — alcance descartado

**Estado:** analizado y descartado el 2026-07-27. No implementado.

## Por qué se descartó

Durante el diseño del costeo de materiales apareció la necesidad de costear el trabajo completo: mano de obra, fletes, transporte y margen contra lo cotizado. Al revisarlo se concluyó que eso es **costeo de órdenes de trabajo**, no gestión de bodega.

EffiGuard nació para saber dónde están las herramientas y reducir el robo. La línea quedó así:

| Pieza | ¿Sirve al propósito? |
|---|---|
| Ubicación en bodega | Sí, es literalmente el propósito |
| Valorizar pérdidas y robos | Sí — un robo en pesos se explica, en unidades se pasa de largo |
| Consumo de material por proyecto | Sí, indirectamente: un consumo anómalo es desperdicio o robo |
| Mano de obra, fletes, margen | **No** — responden "¿gané plata?", no "¿dónde está mi herramienta?" |

Razón adicional: al momento de decidir, el sistema tenía cinco cambios propuestos, cuatro implementados y **cero usuarios reales**. Construir costeo de órdenes sobre un núcleo que nadie ha usado significa descubrir tarde si el núcleo funciona.

Observación de producto: un taller que quiere costeo de órdenes es un cliente distinto de una constructora que quiere dejar de perder herramientas. Perseguir ambos hace competir con ERPs por un lado y con rastreadores de activos por el otro.

## Contexto del negocio que lo motivó

El cliente opera como taller: recibe pedidos, fabrica en taller e instala en terreno donde el cliente indique. El costo real de un trabajo incluye material, horas de operario, uso de herramientas y traslados.

## Decisiones que ya se tomaron, si se retoma

Estas respuestas ya están dadas y no hay que volver a preguntarlas:

- **Captura de horas: marcación con credencial.** El operario escanea su credencial RFID al iniciar y al cerrar en una orden. Aprovecha el hardware y las credenciales existentes, y produce horas reales en vez de estimadas de memoria.
- **Sí registrar lo cobrado.** La orden guarda cliente y monto cotizado, y el dashboard muestra margen. Sin eso el costeo informa pero no permite decidir.
- **Separar taller de instalación.** Cada movimiento y cada hora se imputa a una etapa, para ver dónde se va el costo.

## Secuencia que se había planificado

1. **`orden-de-trabajo`** — `Project` evoluciona a OT: cliente, monto cotizado, fechas, estado. Aparece la **etapa** (taller / instalación) como dimensión transversal. Es la base: sin esto los demás no tienen dónde colgarse.
2. **`costeo-por-proyecto`** — materiales y herramientas, con etapa.
3. **`mano-de-obra`** — marcación, turnos, `costo_hora` por usuario. El más grande.
4. **`gastos-de-orden`** — flete, bencina, transporte: categoría, monto, OT, etapa, comprobante.
5. Consolidación y margen, dentro del último.

## Problemas abiertos que habría que resolver

- **Estación de marcación.** El operario necesita un puesto físico donde escanear al entrar y salir. El hardware existe (lectores HID, PWA en tablet) pero el puesto no está definido. Sin él la marcación no ocurre y el costo de mano de obra queda vacío.
- **Turnos que nadie cierra.** Si un operario marca entrada el viernes y se va sin cerrar, el lunes acumula 72 horas. Necesita una regla: cierre automático al fin de jornada, tope de horas, o cierre implícito al marcar en otra orden. Es el mismo problema que tuvieron los despachos abiertos, resuelto allí con el cierre por proyecto.
- **La etapa agrega un campo obligatorio** a cada marcación y a cada retiro de material. Es fricción real en el flujo del operario y hay que diseñarla con cuidado.

## Qué sí quedó implementado de todo esto

Del alcance original sobrevivió sólo lo que sirve a la génesis: `precio_compra` en consumibles, costo congelado en cada movimiento, y costo de material por proyecto con consumo, pérdidas y mermas en líneas separadas. Ver el cambio `costeo-por-proyecto`.
