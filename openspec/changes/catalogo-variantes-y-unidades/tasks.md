> **Estado — implementado y en uso.**
> El catálogo viejo se retiró (migración `026` dropea `assets` y `models`; `loans`
> referencia unidades desde la `025`). Catálogo, escaneo, préstamos, devoluciones,
> kits, reparaciones, inventario, dashboard e integraciones operan sobre
> producto → variante → unidad. Lo que queda abierto es acabado y verificación,
> no migración.
>
> Documentación actualizada: `README.md`, `AGENTS.md`, `openspec/config.yaml`,
> `openspec/notas/flujo-variantes-y-unidades.md` y `openspec/notas/contrato-n8n.md`.

## 1. Cierre previo

- [ ] 1.1 Terminar y archivar `valor-de-bodega`, o decidir explícitamente reapuntarlo a `variantes` dentro de este cambio — no avanzar en paralelo sobre las mismas tablas
- [ ] 1.2 Confirmar que `ubicacion-y-reintegro-consumibles` está cerrado, o incorporar sus tipos de movimiento pendientes al rediseño de `inventory_logs`

## 2. Modelos y migración

- [x] 2.1 Crear `models/producto.py`: `tenant_id`, `family_id`, `brand_id` nullable, `nombre`, `descripcion`
- [x] 2.2 Crear `models/variante.py`: `producto_id`, `nombre`, `atributos` JSONB, `unidad`, `stock_actual`, `stock_minimo`, `precio_compra`, `valor_reposicion`, `dias_max_prestamo`, `ubicacion_id` nullable
- [x] 2.3 Crear `models/unidad.py`: `variante_id`, `estado_id`, `ubicacion_id` nullable, `parent_unidad_id` nullable, `proxima_mantencion`, `created_at`
- [x] 2.4 Crear `models/codigo.py`: `variante_id`/`unidad_id` con CHECK de exactamente uno, `codigo`, `tipo` (`fabricante`, `proveedor`, `empaque`, `propio`, `serie_fabrica`), `proveedor_id` nullable, `factor` default 1, `nombre_empaque` nullable, `es_principal`
- [x] 2.5 Crear `models/proveedor.py`: `tenant_id`, `nombre`, `rut` nullable, `contacto` nullable
- [x] 2.6 Reapuntar `models/loan.py` de `asset_id` a `unidad_id` (migración `025`)
- [x] 2.7 Reapuntar `models/inventory_log.py`: `variante_id`, `unidad_id`, `codigo_id` y `proveedor_id` nullable con `ON DELETE SET NULL` (`variante_id` queda nullable mientras dura la convivencia; pasa a NOT NULL en el tramo 2)
- [x] 2.8 Eliminar `models/asset.py` y `models/asset_model.py`; actualizar `models/__init__.py`, `brand.py`, `ubicacion.py` y `asset_family.py`
- [x] 2.9 Migración `020_productos_variantes_unidades.py`: crea las cinco tablas y agrega las columnas de convivencia a `inventory_logs`. El drop de `assets`/`models` y el reapunte de `loans` van en la migración del tramo 2
- [x] 2.10 Índices y restricciones: `UNIQUE (tenant_id, codigo)`, único parcial de `es_principal` por dueño, GIN sobre `variantes.atributos`, FK con `tenant_id` indexado en las cinco tablas
- [x] 2.11 Verificar que `alembic upgrade head` corre limpio
- [ ] 2.12 Probar `alembic downgrade` de la 020 (el `DELETE FROM inventory_logs WHERE asset_id IS NULL` del downgrade no está ejercitado)
- [x] 2.13 Migración `021_menu_catalogo.py`: ítem de menú `/catalogo` para super_admin, admin y bodeguero

## 3. Repositorios

- [x] 3.1 Crear `repositories/producto.py` sobre `BaseRepository`, con listado por familia y por marca
- [x] 3.2 Crear `repositories/variante.py`: listado paginado con filtro por comportamiento, producto y atributo JSONB; consulta con códigos y unidades
- [x] 3.3 Implementar el stock efectivo en `repositories/variante.py`: columna para consumibles, `COUNT(unidades WHERE estado_id = 1)` para prestables, en una sola query
- [x] 3.4 Implementar `low_stock()` unificado comparando `stock_minimo` contra el stock efectivo, excluyendo `stock_minimo = 0`
- [x] 3.5 Crear `repositories/unidad.py`: alta por cantidad y conteos por variante
- [x] 3.5b Kits padre-hijo entre unidades: se prestan y devuelven en bloque
- [x] 3.6 Crear `repositories/codigo.py`: resolución por código dentro del tenant en una consulta y alta con detección de duplicado (la validación tipo/nivel quedó en `services/catalogo.py`, que es donde se decide)
- [x] 3.7 Crear `repositories/proveedor.py`: validación de uso por códigos antes de borrar, alta implícita por nombre, y consulta de los proveedores conocidos de una variante
- [x] 3.8 Actualizar `repositories/loan.py` e `repositories/inventory_log.py` a las nuevas FK
- [x] 3.9 Eliminar `repositories/asset.py`
- [x] 3.10 Verificar que ninguna query nueva omite `tenant_id`

## 4. Servicios

- [x] 4.1 Crear `services/catalogo.py` con el alta en un solo paso: producto + variante homónima cuando no se declaran variantes
- [x] 4.2 Implementar en `services/catalogo.py` la gestión de `es_principal`: primer código automático, promoción al borrar, cambio manual excluyente
- [x] 4.3 Implementar las reglas de eliminación por nivel (variante con stock o unidades, producto con una sola variante). El bloqueo por préstamo abierto entra en el tramo 2, cuando el préstamo pase a la unidad
- [x] 4.4 Implementar el bloqueo de cambio de familia con unidades existentes
- [x] 4.4b Validar que el tipo del código corresponde a su nivel (`fabricante`/`proveedor`/`empaque` en variante, `serie_fabrica` en unidad)
- [x] 4.5 Nuevo `services/prestamo.py`: préstamo y devolución sobre unidades, kits entre unidades, validación del kit completo antes de crear ningún préstamo
- [x] 4.6 Implementar el préstamo a partir de una variante: elección de ejemplar disponible y preselección cuando queda uno
- [x] 4.7 Servicio de inventario sobre `variante_id`: retiro, compra, ajuste, merma, pérdida y reintegro, con `unidad_id` en los movimientos de herramienta
- [x] 4.8 Implementar la compra por empaque tomando el `factor` del `codigo_id` enviado, validando que el código pertenezca a la variante
- [x] 4.9 Deducir el `proveedor_id` de la compra desde el `codigo_id`, permitiendo que el usuario lo sobrescriba y aceptando compras sin proveedor
- [x] 4.10 Resolver la ubicación efectiva con precedencia unidad → variante
- [x] 4.11 Eliminar `services/asset.py` y `services/loan.py` una vez migrada su lógica

## 5. API

- [x] 5.1 CRUD de productos con listado filtrable por familia, marca y texto (`api/v1/catalogo.py`)
- [x] 5.2 CRUD de variantes, `low-stock`, `purchase`, `withdraw`, `adjust`, `shrinkage`, `loss`, `reintegro`, `despachos-pendientes` y `movimientos`
- [x] 5.3 Unidades: alta por cantidad con UID `EFG-XXXXXXXX`, consulta, edición, borrado validado, `loss`, `repair-done` y `reingreso`
- [x] 5.4 Códigos: alta en variante y en unidad, borrado con promoción y marcado de principal
- [x] 5.5 Crear `api/v1/proveedores.py`: CRUD con bloqueo de borrado en uso, más los proveedores conocidos de una variante
- [x] 5.6 `GET /api/v1/scan-catalogo/{codigo}` resolviendo variante o unidad e indicando cuál resolvió. Convive con `/assets/scan/{uid}`; lo reemplaza en el tramo 2 pasando a `/scan/{codigo}`
- [x] 5.7 Actualizar `api/v1/loans.py` a `unidad_id`, con préstamo desde variante, ejemplares disponibles y piezas del kit
- [~] 5.8 `api/v1/inventory.py` sobre el catálogo nuevo: bitácora con producto · variante, código escaneado e historial por variante. Falta el endpoint de historial por unidad y el filtro por `proveedor_id`
- [x] 5.9 `api/v1/dashboard.py` completo sobre el catálogo nuevo: KPIs, quiebres unificados, distribución por estado sobre unidades, vencidos con producto y variante, valor de bodega y gasto por obra con detalle de materiales
- [x] 5.10 Actualizar `api/v1/catalog.py` (marcas) y eliminar los endpoints de `models`
- [x] 5.11 `assets/query` reimplementado sobre variantes en `api/v1/integraciones.py`, con búsqueda exacta por código. Conserva la ruta para no reconfigurar n8n
- [x] 5.12 Eliminar `api/v1/assets.py`
- [x] 5.13 Crear `schemas/catalogo.py` con la nueva jerarquía. La reescritura de `schemas/asset.py` e `inventory.py` va en el tramo 2

## 6. Importación y datos

- [x] 6.1 Crear `api/v1/import_catalogo.py` con las columnas nuevas y upsert por par (`producto`, `variante`) para filas consumibles
- [x] 6.2 Implementar el parseo de la columna `codigos` con formato `codigo[:tipo[:factor[:proveedor]]]` separado por `;`, creando el proveedor por nombre si no existe
- [x] 6.3 Implementar `cantidad_unidades`: crea N unidades con UID autogenerado, sólo cuando la fila crea la variante; advertencia si la variante ya existe; error en filas consumibles
- [x] 6.4 Implementar la carga de herramientas ya etiquetadas: una fila por ejemplar con upsert por terna (`producto`, `variante`, primer código de nivel unidad)
- [x] 6.5 Rutear cada código de la columna a su nivel según el tipo, ignorando sin error las repeticiones de un código de variante ya registrado en filas anteriores del mismo modelo
- [x] 6.6 Rechazar las filas prestables que declaran `cantidad_unidades` junto con códigos de nivel unidad (`propio` o `serie_fabrica`)
- [x] 6.7 Traducir `stock_actual` a movimiento: log de apertura al crear la variante, `ajuste` con observación al actualizar, sin efecto si la celda viene vacía, ignorado en filas prestables
- [x] 6.8 Actualizar el template descargable: una fila por variante, con `stock_actual` y `cantidad_unidades` vacías
- [x] 6.9 Extender el reporte de `dry_run` con los ajustes de stock que se aplicarían y las advertencias por fila
- [x] 6.10 Verificar `dry_run` y el reporte de errores por fila, incluido el rechazo por código duplicado
- [x] 6.11 Cargar `openspec/notas/ejemplo-template-carga.csv` de punta a punta y verificar que produce 3 productos, 5 variantes, 6 unidades y 2 proveedores
- [ ] 6.12 Actualizar el seed de demo: incluir un consumible con dos códigos de proveedor y dos empaques de distinto factor, y una herramienta con varias unidades
- [x] 6.13 Eliminar `api/v1/import_assets.py` (importador del catálogo viejo)

## 7. Frontend

- [x] 7.0 Crear `pages/Catalogo.tsx`: carga por Excel con validación previa y listado de productos → variantes → ejemplares con sus códigos
- [x] 7.1 `Assets.tsx`, `AssetEdit.tsx` y `Scanner.tsx` eliminados: `Catalogo.tsx` y `EscanearCatalogo.tsx` los reemplazan
- [x] 7.2 CRUD completo desde `Catalogo.tsx`: alta de producto y de variante, edición de ambos y borrado con sus bloqueos. El Excel queda para el arranque; el día a día es la interfaz
- [x] 7.3 Gestor de códigos: alta con tipo, proveedor, factor y nombre de envase; marcado de principal y borrado. Crea el proveedor al vuelo si no existe
- [x] 7.3b Modal de compra: por empaque (el factor lo aporta el código elegido) o por unidad, con el total en unidades y el stock resultante a la vista antes de confirmar
- [x] 7.4 Gestión de ejemplares desde la interfaz: alta por cantidad, cambio de ubicación, borrado validado e impresión de etiqueta reutilizando `LabelPreviewModal`
- [x] 7.5 Crear la mantención de proveedores (`pages/Proveedores.tsx`) y su entrada en el menú dinámico (migración `022_menu_proveedores.py`)
- [x] 7.6 `pages/EscanearCatalogo.tsx` contra `/scan-catalogo`, reutilizando la captura HID, cámara y NFC, con la precedencia completa de acciones para consumibles y herramientas. El ítem "Escanear" del menú apunta acá (migración `024`)
- [ ] 7.7 Agregar el flujo de asociar un código escaneado sin resultado a una variante o unidad existente
- [x] 7.8 Modales viejos de `components/scanner/` eliminados; sólo quedan `CameraScanner` y `NFCScanner`, que son agnósticos del modelo
- [~] 7.9 El formulario de compra deduce el proveedor del código escaneado y muestra el precio unitario resultante con advertencia de salto. Falta ofrecer los proveedores conocidos como selección rápida cuando no hay código
- [ ] 7.10 Actualizar `Inventory.tsx`, `Dashboard.tsx`, `Loans.tsx`, `MyLoans.tsx` y `Ubicaciones.tsx` a la nueva forma de las respuestas
- [x] 7.11 `LabelPreviewModal.tsx` imprime el código principal del ejemplar (se reutilizó tal cual: ya era agnóstico del modelo)
- [x] 7.12 `ImportAssetsModal.tsx` retirado junto con el importador viejo
- [ ] 7.13 Revisar móvil desde 320px y altura táctil de 48px en las vistas nuevas

## 8. Verificación

- [x] 8.1 Probar el caso que motivó el cambio: un consumible con códigos de dos proveedores y dos empaques de distinto contenido, verificando un solo pozo de stock
- [x] 8.1b Verificar que las compras por empaque suman correctamente
- [x] 8.2 Probar el ciclo completo de herramienta: préstamo, devolución, envío a reparación y cierre
- [ ] 8.3 Probar kits con datos: préstamo y devolución en bloque, y el rechazo cuando una pieza no está disponible (implementado y validado por código, sin ejercitar con un kit real)
- [x] 8.4 Verificar el aislamiento multi-tenant: el mismo EAN registrado en dos tenants resuelve distinto en cada uno, y una variante ajena responde 404 en vez de filtrarse
- [ ] 8.5 Verificar la alerta de quiebre en ambos comportamientos y que `stock_minimo = 0` la desactiva (implementado y expuesto en `/variantes/low-stock`, falta ejercitarlo con datos)
- [x] 8.6 Probar la reimportación segura: reimportar el mismo archivo y verificar que no se movió el stock ni se duplicaron ejemplares
- [x] 8.7 Probar la carga de herramientas por las dos vías: `cantidad_unidades` y un lote ya etiquetado con una fila por ejemplar
- [ ] 8.8 Verificar que una compra escaneada y una tipeada a mano quedan ambas con proveedor en el log
- [~] 8.9 Endpoint verificado con API key real: búsqueda por producto, por variante y por código exacto, con y sin préstamos. Contrato documentado en `openspec/notas/contrato-n8n.md`. **Falta ajustar el workflow en n8n**, que se hace allá y no acá
- [ ] 8.10 Recorrer los escenarios de las specs y marcar los que quedan sin cubrir
