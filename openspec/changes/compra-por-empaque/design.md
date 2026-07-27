## Context

EffiGuard lleva el stock de consumibles en una sola unidad, la de despacho. Esa decisión ya está tomada y es correcta: el reintegro de sobrantes sólo se puede expresar ahí. Lo que falta es que la compra pueda hablar en la unidad del proveedor sin romper esa regla.

El caso concreto: cajas de 100 tornillos y rollos de 100 metros de luces LED. Se compran por caja y por rollo; se despachan por tornillo y por metro.

## Goals / Non-Goals

**Goals:**

- Que ingresar una compra de 3 cajas no exija multiplicar a mano.
- Que el movimiento registrado siga estando en la unidad de stock, para que la bitácora sea homogénea.
- Que quede constancia del empaque original en el movimiento, para poder auditar contra la factura del proveedor.
- Que quien no use empaques no note ningún cambio.

**Non-Goals:**

- Un catálogo de empaques con su propia mantención. Es un atributo del activo, no una entidad.
- Llevar el stock simultáneamente en dos unidades. Sigue habiendo una sola unidad de verdad.
- Aceptar empaques en merma, ajuste o pérdida. Ésas se cuentan en la unidad de despacho, que es donde ocurren.
- Convertir entre unidades distintas (metros a kilos). El empaque es un múltiplo de la misma unidad, no otra magnitud.

## Decisions

### El empaque es un multiplicador en el activo, no una entidad

`assets` incorpora `contenido_por_empaque` (`Numeric(12,3)`, nulo) y `nombre_empaque` (`varchar(20)`, nulo).

Es `Numeric` y no entero porque un empaque puede traer una medida fraccionaria: un tambor de 20,5 litros es tan válido como una caja de 100 tornillos.

`nombre_empaque` existe para que la interfaz pueda decir "3 cajas" y "2 rollos" en vez de "3 empaques", que no es como habla nadie en una bodega. Es texto libre y no un enum: los envases reales son cajas, rollos, tambores, sacos, pallets y bidones, y enumerarlos sería adivinar.

*Alternativa considerada:* una tabla `empaques` por tenant con su mantención. Se descarta porque el contenido es propio de cada producto —una caja de tornillos M3.5 no trae lo mismo que una de M5— así que la tabla tendría una fila por activo y no ahorraría nada.

### La compra acepta `empaques` o `cantidad`, nunca ambos

`AssetPurchase` pasa a tener los dos campos opcionales, con la regla: exactamente uno debe venir.

Aceptar los dos obligaría a decidir cuál gana ante una discrepancia, y cualquier respuesta sería una suposición sobre lo que el bodeguero quiso decir. Rechazar la petición es más honesto y el error se corrige en el momento, no seis meses después en un descuadre.

`empaques` exige que el activo tenga `contenido_por_empaque` configurado; si no lo tiene, la petición falla indicando que hay que configurarlo. Asumir un contenido por defecto sería inventar el dato.

### El movimiento se registra en la unidad de stock

El log de compra guarda `cantidad = empaques × contenido_por_empaque` — 300, no 3.

Es lo que mantiene la bitácora homogénea: todos los movimientos de un activo se suman y restan en la misma unidad, y el consumo por proyecto sigue siendo comparable. Guardar 3 obligaría a que cada consulta supiera si ese número está en unidades o en empaques.

El empaque original no se pierde: se deja en las observaciones ("Compra: 3 cajas de 100 unidad"), que es donde el bodeguero lo va a buscar cuando compare contra la factura. Si el usuario escribe su propia observación, la del empaque se antepone en vez de reemplazarla.

*Alternativa considerada:* una columna `empaques` en `inventory_logs`. Se descarta por no agregar una columna que sólo tendría valor en un tipo de movimiento de nueve, cuando el dato cabe en un campo que ya existe.

### La equivalencia es de sólo lectura

La interfaz muestra "9.000 un. (90 cajas)" donde el número grande es la unidad de stock y el paréntesis es ayuda visual. No hay un campo editable en cajas: editar ahí abriría la puerta a que dos números se contradigan.

## Risks / Trade-offs

**Cambiar `contenido_por_empaque` no reinterpreta el historial** → Si un proveedor pasa de cajas de 100 a cajas de 50, las compras ya registradas mantienen su cantidad en unidades, que es la correcta; sólo su observación queda hablando del empaque viejo, que es justamente lo que pasó. No hay nada que migrar.

**El equivalente en empaques puede dar decimales** ("90,5 cajas") → Es información real: hay 9.050 unidades, o sea noventa cajas y media. La interfaz lo muestra con un decimal en vez de redondear y mentir.

**Alguien puede configurar el empaque en un activo prestable**, donde no significa nada → Los campos se ofrecen sólo para familias de comportamiento `consumible` en la interfaz. El backend no lo prohíbe: sería una validación que sólo agrega rigidez, porque el dato simplemente no se usa.

## Migration Plan

1. Migración Alembic que agrega las dos columnas, ambas nulas. No hay backfill: los activos existentes quedan sin empaque y siguen comprándose por unidad.
2. Despliegue normal. El cambio es aditivo y compatible hacia atrás en la API: `cantidad` sigue funcionando igual.

**Rollback:** eliminar ambas columnas. Las compras ya registradas conservan su cantidad correcta en unidades, así que no se pierde información de inventario — sólo la configuración del empaque.
