## Why

El operario llega al mesón a pedir material sin saber si existe. El bodeguero deja lo que está haciendo, camina al rack, vuelve y responde "no hay" o "hay, pero de otra medida". Esa consulta a viva voz es el cuello de botella de la bodega y ocurre decenas de veces al día, siempre con la misma pregunta: **¿hay, y dónde está?**

El sistema ya tiene el dato —stock por variante, ubicación con precedencia de unidad sobre variante— pero hoy sólo lo ve quien mantiene el catálogo. El operario, que es quien necesita el material, es el único rol sin acceso a él.

Además, el rol operario nunca tuvo spec propia: aparece disperso en otras capabilities y siempre como *sujeto* del flujo (a quién se le entrega), nunca como *usuario* de la aplicación. Eso ya dejó pasar un error: la migración `024` reapuntó el ítem "Escanear" a `/catalogo/scan` sin revisar quién lo tenía, y el operario terminó con acceso al escáner de despacho —la pantalla que descuenta stock y crea préstamos—. No había documento contra el cual contrastarlo.

## What Changes

- **Nueva pantalla "Bodega"** para el operario: busca un material por nombre o código y ve si hay y dónde está, sin costos ni precios.
- La consulta SHALL responder con cantidad exacta y ubicación física (rack, nivel, posición), distinguiendo consumibles (stock) de prestables (ejemplares disponibles sobre el total).
- **Nuevo endpoint de consulta de bodega**, de sólo lectura y sin datos de costo, disponible para cualquier rol autenticado del tenant.
- **BREAKING para el rol operario** — se le retira el permiso sobre el escáner de despacho (`/catalogo/scan`). Despachar es gesto del bodeguero en el mesón; que el operario pudiera hacerlo era un arrastre de la migración `024`, no una decisión.
- **"Mis Préstamos" pasa a ser un ítem de menú real** (`/my-loans`). Hoy no existe como `menu_item`: el operario llega ahí por un redirect desde `/`, así que el menú lateral le muestra "Dashboard" apuntando a una pantalla que no verá.
- El menú del rol operario queda **fijado en la spec**, no delegado a "lo que el seed le asignó".
- El frontend SHALL cortar por rol las rutas fuera del alcance del operario. Hoy `PrivateRoute` sólo valida sesión: un operario que tipee `/users` o `/catalogo` en la barra de direcciones entra a la pantalla, aunque el backend le niegue los datos.
- Se documenta por primera vez el comportamiento de la pantalla "Mis Préstamos": días transcurridos y marca de devolución vencida.

## Capabilities

### New Capabilities

- `experiencia-operario`: todo lo que el rol operario puede hacer en la aplicación — su pantalla de entrada, su menú, la consulta de bodega, la vista de sus préstamos vigentes, y lo que explícitamente no alcanza.

### Modified Capabilities

- `navegacion-dinamica`: el menú del operario deja de definirse por remisión al seed; la spec fija el conjunto de ítems del rol y "Mis Préstamos" se incorpora como ítem de menú.

## Impact

**Backend**

- Nuevo router de consulta de bodega bajo `/api/v1/bodega`, apoyado en `VarianteRepository` y `UnidadRepository` existentes. Sin tablas nuevas.
- Nuevo schema de respuesta sin `precio_compra` ni `valor_reposicion`: la consulta no puede reutilizar `VarianteResponse`, que los expone.
- Migración Alembic: alta del `menu_item` "Bodega" y del ítem "Mis Préstamos", permisos del rol operario sobre ambos, y baja de su permiso sobre "Escanear".

**Frontend**

- Nueva página `Bodega.tsx`, mobile-first, pensada para leerse a una mano caminando hacia el mesón.
- `PrivateRoute` gana verificación de rol; las rutas de mantención y despacho quedan cerradas al `role_id 4`.

**Sin impacto**

- No cambia el modelo de datos, ni el flujo de despacho, ni los endpoints de catálogo existentes. La consulta es estrictamente de lectura.
