## Context

Con el precio de compra cargado y el costo congelado en cada movimiento, la información para valorizar el inventario ya está completa. Falta la consulta que la agrega y el panel que la muestra.

## Goals / Non-Goals

**Goals:**

- Responder cuánta plata hay inmovilizada en existencias.
- Hacer visible dónde se concentra ese dinero y hace cuánto que no se mueve.
- No mezclar capital de trabajo con activo fijo.

**Non-Goals:**

- Depreciación del parque de herramientas. Se valorizan a reposición, que es lo que costaría reemplazarlas hoy.
- Rotación formal de inventario ni cobertura en días. Requiere modelar consumo promedio, y el tiempo desde el último movimiento ya señala lo mismo con un dato que existe.
- Valorización a precio de mercado o reajuste por inflación.

## Decisions

### Existencias y herramientas se reportan por separado

Los consumibles se valorizan como `stock_actual × precio_compra`; los prestables, contando cada unidad a su `valor_reposicion`.

Sumarlos daría un número sin significado. Un tornillo en bodega es capital de trabajo: salió de la caja y vuelve cuando el material se consuma y se cobre. Una lijadora es activo fijo: no se consume, se posee. El dueño quiere saber ambas cosas, pero son dos preguntas y se responden en dos líneas.

*Las herramientas usan `valor_reposicion` y no `precio_compra`* porque no tienen precio unitario de compra —no se compran por unidad de stock— y porque lo relevante de un parque de herramientas es cuánto costaría reponerlo.

### El detalle se ordena por valor, no alfabéticamente

El panel lista los activos que más plata concentran, de mayor a menor.

Un listado completo del inventario no cabe ni se lee. Lo que decide es la concentración: en casi toda bodega, unos pocos ítems acumulan la mayor parte del valor, y son esos los que vale la pena revisar.

### El tiempo desde el último movimiento acompaña a cada monto

Cada ítem del detalle informa cuántos días pasaron desde su último movimiento de inventario, o desde su creación si nunca tuvo ninguno.

Es lo que convierte el monto en decisión. Un consumible caro que rota todas las semanas es inventario sano; el mismo monto sin tocarse hace ocho meses es plata comprada de más. El dato sale de la bitácora que ya se registra, sin agregar nada.

### Lo no valorizado se cuenta aparte

Los activos sin precio configurado se informan como cantidad, no se suman como cero.

Mismo criterio que en el costeo por proyecto: un total que trata lo desconocido como gratis transmite una precisión que no tiene.

### El panel vive en el dashboard

Se muestra junto al de gasto por obra, no en una pantalla propia.

Es una cifra de vistazo, no una herramienta de trabajo: se mira, se decide si hay algo que revisar, y se entra al activo. Una pantalla dedicada implicaría que alguien la visita a propósito, y nadie lo haría.

## Risks / Trade-offs

**El valor depende de que los precios estén cargados** → Sin precio no hay valorización, y por eso el conteo de activos sin precio se muestra junto al total: indica cuánta confianza merece la cifra.

**El valor de reposición puede estar desactualizado** → Es un dato que se carga a mano y nadie lo revisa. La cifra de herramientas debe leerse como orden de magnitud, no como tasación.

**El tiempo sin movimiento no distingue tipos de movimiento** → Un ajuste de inventario cuenta igual que un despacho, así que un activo "tocado" por una corrección aparece como si hubiera rotado. Es aceptable: el caso normal es que los movimientos sean entregas.

## Migration Plan

Ninguna. Es una consulta de lectura sobre datos existentes.
