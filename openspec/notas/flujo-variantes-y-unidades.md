# Flujo punta a punta con el modelo producto → variante → unidad

Recorrido completo de los dos casos que motivaron el cambio `catalogo-variantes-y-unidades`,
con datos concretos. Todo lo descrito está implementado y probado.

**Datos del ejemplo**

- Consumible: *Tornillo autoperforante* / variante *6x40 zincado*. Se compra a Sodimac
  (caja de 100) y a Construmart (caja de 250). Tres códigos de proveedor, dos de empaque.
- Herramienta: *Taladro percutor GSB-13RE* (Bosch), 3 ejemplares.

---

## 1. Carga inicial por Excel

El bodeguero descarga el template y llena dos filas:

| producto | variante | familia | marca | unidad | stock_actual | stock_minimo | precio_compra | valor_reposicion | dias_max_prestamo | codigos | cantidad_unidades | ubicacion |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Tornillo autoperforante | 6x40 zincado | Consumible | | unidad | 500 | 200 | 12 | | | `7801234567890:proveedor:1:Sodimac;7809876543210:proveedor:1:Construmart;17801234567890:empaque:100:Sodimac;17809876543210:empaque:250:Construmart` | | RACK-A/N2/P3 |
| Taladro percutor GSB-13RE | | Herramienta | Bosch | unidad | | 1 | | 180000 | 7 | | 3 | RACK-C/N1/P1 |

Sube con `dry_run=true`: **2 productos, 2 variantes, 4 códigos, 3 unidades y 2 proveedores
a crear; 1 ajuste de stock (0 → 500); 0 errores**. Confirma y se escribe.

Qué quedó:

- Producto *Tornillo autoperforante* → variante *6x40 zincado*, stock 500, mínimo 200,
  con sus 4 códigos. Los dos de empaque llevan factor 100 y 250, y los cuatro quedan
  atados a su proveedor. Sodimac y Construmart se crearon solos, por nombre.
- El stock 500 **no se escribió directo**: se registró un log tipo `ajuste` con la
  observación *"Saldo de apertura: importación Excel"*, así la bitácora arranca cuadrada.
- Producto *Taladro percutor GSB-13RE* → variante homónima (fila sin `variante`), con
  **3 unidades** creadas por `cantidad_unidades`, en estado Disponible y con código
  principal autogenerado: `EFG-7K2M9X4A`, `EFG-3P8QW1ZB`, `EFG-M5RT2N7C`.

Se imprimen las 3 etiquetas y la variante reporta **3 de 3 disponibles**.

> Si las herramientas ya vinieran etiquetadas de antes, en vez de `cantidad_unidades`
> se pone **una fila por ejemplar** con el mismo `producto` y `variante`, cada una con
> su código en la columna `codigos`. Las dos vías son excluyentes en una misma fila.

### Reimportar es seguro

El template descargado trae `stock_actual` y `cantidad_unidades` **vacías**. Editar
nombres, precios, mínimos o agregar el código de un proveedor nuevo y volver a subir
no toca el inventario ni duplica ejemplares. Si se quiere cuadrar el stock después de
un conteo físico, se escribe el número a mano y queda como `ajuste` con su log —nunca
como una escritura muda.

---

## 2. Compra: llegan 3 cajas de Construmart

1. El bodeguero escanea el código de la caja: `17809876543210`.
2. `GET /api/v1/scan-catalogo/17809876543210` resuelve a la **variante** *6x40 zincado*,
   con `tipo = empaque` y `factor = 250`.
3. Por la precedencia de acciones, la principal es **"Registrar Compra"**, con
   250 unidades por empaque ya precargadas.
4. Ingresa `3` empaques.
   `POST /api/v1/variantes/{id}/purchase { empaques: 3, codigo_id: N }`
5. El formulario muestra **Construmart** como proveedor, deducido del código — el
   bodeguero no lo eligió.
6. Stock: **500 → 1250**. El log guarda `cantidad = 1250` (unidad de stock, no cajas),
   el `codigo_id` del empaque, el `proveedor_id` y la observación
   *"Compra: 3 cajas de 250 unidad"*.

Si la próxima compra viene de Sodimac, escanea `17801234567890`, factor 100,
y 3 cajas suman 300 al **mismo** stock, con Sodimac en el log.

**Compra sin escanear:** si ingresa "300 unidades" a mano, no hay código del cual
deducir nada, así que el formulario ofrece como selección rápida los proveedores que
esa variante ya conoce —Sodimac y Construmart—. Dos toques, y el dato no queda cojo.
El campo es opcional: una compra sin proveedor se registra igual.

---

## 3. Retiro de consumible

Un maestro pide 80 tornillos. El bodeguero saca un tornillo suelto de una caja de
Sodimac y escanea el código de proveedor **de Sodimac**: `7801234567890`.

1. Resuelve a la **misma variante**, aunque el stock haya entrado por Construmart.
   Ése es el punto entero del cambio: el código identifica *qué es*, no *de qué pila sale*.
2. Se muestra stock 1250 contra mínimo 200 — sin resaltar, está sobre el mínimo.
3. Acción principal: **"Retirar Consumible"**.
4. Escanea la credencial del operario (`GET /api/v1/users/scan/{uid}`) y elige el proyecto.
5. `POST /api/v1/variantes/{id}/withdraw { cantidad: 80, operario_id, project_id }`
6. Stock: **1250 → 1170**. Log tipo `entrega` con `variante_id`, `unidad_id` nulo,
   operario, proyecto y `costo_unitario` congelado.
7. **No se crea ningún registro en `loans`** — un tornillo no se devuelve.

---

## 4. Préstamo de herramienta

1. El bodeguero escanea el QR del taladro: `EFG-7K2M9X4A`.
2. Resuelve a una **unidad** (no a una variante): estado Disponible, sin préstamo abierto,
   sin unidades hijas.
3. Acción principal: **"Registrar Préstamo"**.
4. Escanea la credencial del operario, elige proyecto y fecha de devolución prevista.
5. `POST /api/v1/loans { unidad_id, operario_id, project_id, fecha_devolucion_prevista }`
6. La unidad pasa a **En Terreno (2)**. Log tipo `entrega` con `variante_id` **y** `unidad_id`.
7. La variante ahora reporta **2 de 3 disponibles**, sin que se haya escrito ninguna
   columna de stock.

### Variante: escaneo del código de la variante en vez del ejemplar

Si el bodeguero escanea un código de la *variante* del taladro en vez del QR de un
ejemplar, la interfaz muestra **"2 de 3 disponibles"** y ofrece elegir cuál prestar.
Con un solo disponible, lo preselecciona.

### Kits

Si la unidad tiene piezas hijas, el modal las lista antes de confirmar y el préstamo
las incluye todas. La validación es previa: si una pieza está prestada o en
reparación, **no se crea ningún préstamo** — entregar media caja y descubrirlo a
mitad de camino deja registros que no se pueden deshacer.

---

## 5. Devolución de la herramienta

1. Escanea `EFG-7K2M9X4A`. Resuelve la unidad: estado En Terreno, con préstamo abierto.
2. Acción principal: **"Registrar Devolución"**, mostrando quién la tiene, desde cuándo,
   quién la entregó y a qué proyecto.
3. Escanea la credencial de quien devuelve. Confirmar quién la trae es obligatorio;
   que sea el titular, no — ver más abajo.
4. `POST /api/v1/loans/{loan_id}/return { returning_user_id, observaciones }`

**Devolución normal:** se registra `fecha_devolucion_real`, la unidad vuelve a
Disponible (1), se crea un log `devolucion`. La variante vuelve a **3 de 3**.

**Devolución con `send_to_repair = true`:** la unidad queda En Reparación y se
generan **dos** logs — `devolucion` y `reparacion`. La variante queda en **2 de 3**.
Como su `stock_minimo` es 1, todavía no hay alerta; con mínimo 3 aparecería en el
panel de quiebres junto a los consumibles.

Al terminar la reparación se escanea el mismo QR: la unidad está En Reparación, así
que la acción principal pasa a **"Marcar como reparada"** →
`POST /api/v1/unidades/{id}/repair-done` → vuelve a Disponible con log
`reparacion_completada`.

**La devuelve otro operario.** Si Juan se enfermó y la trae Pedro, se acepta: el
modal avisa que la responsabilidad sigue siendo de Juan, y el log anota "Devuelta
materialmente por Pedro Fernandez". Bloquearlo dejaría al bodeguero con la
herramienta en la mano y un préstamo que no puede cerrar.

---

## 6. La herramienta se pierde… y aparece

`POST /api/v1/unidades/{id}/loss` deja el ejemplar en **Robado**, cierra su préstamo
si lo tenía y descuenta su valor de reposición a la obra. Dejar el préstamo abierto
la mostraría para siempre como "en terreno", que es distinto de "no está".

Si después aparece —quedó en otra camioneta—, el escaneo ofrece **"Apareció —
reingresar a bodega"**. Vuelve a Disponible y el `reingreso` neutraliza la pérdida
en el gasto de la obra, al mismo costo con que se descontó.

La pérdida **no se borra**: quedan los dos movimientos. Pasó, y borrarlo dejaría un
robo sin rastro. Lo que cambió es que dejó de ser definitivo.

---

## 7. Qué ve el dashboard

Con lo anterior registrado:

- **Gasto por obra** — consumo, pérdidas y mermas en líneas separadas, y al abrir el
  proyecto, **en qué materiales** se fue, con cantidad neta de reintegros.
- **Valor de bodega** — existencias a precio de compra y parque de herramientas a
  valor de reposición, separados porque uno es capital de trabajo y el otro activo
  fijo. Prestar no baja el parque; sólo el robo lo baja.
- **Quiebres** — consumibles por su stock y herramientas por ejemplares disponibles,
  en la misma lista.

---

## Huecos detectados al recorrer el flujo

Recorrer el flujo destapó cuatro cosas que las specs no cubrían. Las cuatro ya están
incorporadas al cambio y este documento las refleja:

1. **La columna `codigos` no admitía proveedor.** Ahora el formato es
   `codigo[:tipo[:factor[:proveedor]]]`, y el proveedor se crea por nombre si no existe,
   con el mismo criterio que `familia` y `ubicacion`.
2. **El Excel no podía cargar ejemplares.** Se agregó `cantidad_unidades` para crear N
   unidades con UID autogenerado, y la carga de herramienta ya etiquetada con una fila
   por ejemplar (upsert por terna `producto`, `variante`, primer código).
3. **La reimportación pisaba el stock en silencio.** Ahora un `stock_actual` declarado
   se traduce siempre en un movimiento con log —apertura al crear, `ajuste` al
   actualizar—, `cantidad_unidades` sólo aplica al crear la variante, y el template se
   descarga con ambas columnas vacías.
4. **La compra tipeada a mano perdía el proveedor.** Se agregó `proveedor_id` al log,
   deducido del código escaneado y ofrecido como selección rápida cuando no hay código.
5. **El EAN de fábrica no tenía dónde vivir en una herramienta.** Los 3 ejemplares de un
   modelo comparten el mismo EAN, así que colgarlo de la unidad choca contra
   `UNIQUE (tenant_id, codigo)`. Se agregó el tipo `fabricante` y la regla de que el tipo
   decide el nivel: `fabricante`/`proveedor`/`empaque` cuelgan de la variante,
   `serie_fabrica` de la unidad, `propio` de cualquiera.

Ver [`ejemplo-template-carga.csv`](ejemplo-template-carga.csv) para el archivo de carga
completo, y [`contrato-n8n.md`](contrato-n8n.md) para lo que ve el agente externo.

> **Estado:** todo lo descrito acá está implementado y probado. El catálogo anterior
> (`assets`) se retiró en la migración `026`; préstamos, escaneo, dashboard e
> integraciones operan sobre producto → variante → unidad.
