## 1. Modelo de datos y migración

- [x] 1.1 Crear `models/ubicacion.py` con `tenant_id`, `rack`, `nivel`, `posicion` (`String(20)`), `descripcion` opcional y `UNIQUE (tenant_id, rack, nivel, posicion)`
- [x] 1.2 Agregar a `models/asset.py` el campo `ubicacion_id` (FK nulo a `ubicaciones.id`) con su relación, y `unidad` (`String(10)`, default `"unidad"`)
- [x] 1.3 Cambiar en `models/asset.py` el tipo de `stock_actual` y `stock_minimo` a `Numeric(12, 3)`
- [x] 1.4 Agregar a `models/inventory_log.py` el campo `origen_log_id` (FK autorreferencial a `inventory_logs.id`, nulo, indexado) con su relación
- [x] 1.5 Cambiar en `models/inventory_log.py` el tipo de `cantidad` a `Numeric(12, 3)`
- [x] 1.6 Registrar el modelo nuevo en `models/__init__.py`
- [x] 1.7 Crear la migración Alembic `015_ubicacion_unidad_reintegro` con la tabla `ubicaciones`, las columnas nuevas y las conversiones `USING columna::numeric(12,3)`
- [x] 1.8 Crear la migración de seeds `016_menu_ubicaciones` con el `menu_item` de mantención y sus permisos para admin y bodeguero
- [x] 1.9 Escribir el `downgrade()` de ambas migraciones con `USING ROUND(columna)` y el borrado de tabla y columnas, documentando que es destructivo
- [x] 1.10 Verificar las migraciones levantando el stack y corriendo `alembic upgrade head` sobre datos existentes

## 2. Serialización decimal

- [x] 2.1 Definir en `schemas/common.py` el tipo anotado que serializa `Decimal` como número JSON, no como string
- [x] 2.2 Aplicarlo a `stock_actual` y `stock_minimo` en `schemas/asset.py` y a `cantidad` en `schemas/inventory.py`
- [x] 2.3 Verificar con una llamada real que `GET /assets` y `GET /inventory/logs` devuelven números y no texto entrecomillado

## 3. Catálogo de ubicaciones

- [x] 3.1 Crear `schemas/ubicacion.py` y `repositories/ubicacion.py` sobre `BaseRepository`, normalizando rack, nivel y posición a mayúsculas sin espacios extremos
- [x] 3.2 Crear `api/v1/ubicaciones.py` con listar, crear, actualizar y eliminar, y registrarlo en `router.py`
- [x] 3.3 Devolver 409 al crear una terna que ya existe, incluyendo en la respuesta la ubicación existente
- [x] 3.4 Bloquear la eliminación de una ubicación con activos asignados, respondiendo 409 con la cantidad, siguiendo el patrón de `asset_families`
- [x] 3.5 Exponer los endpoints en cascada: racks distintos del tenant, niveles de un rack, posiciones de un rack y nivel

## 4. Ubicación y unidad en el activo

- [x] 4.1 Agregar `ubicacion_id` y `unidad` a `AssetCreate`, `AssetUpdate` y `AssetResponse`, con la ubicación anidada en la respuesta
- [x] 4.2 Validar en el servicio que `unidad` esté en {unidad, metro, kilo, litro}, respondiendo 422 con las opciones válidas
- [x] 4.3 Validar que la `ubicacion_id` recibida pertenezca al tenant
- [x] 4.4 Agregar los filtros `ubicacion_rack` y `ubicacion_id` a `AssetRepository.list_filtered()` y al endpoint `GET /assets`
- [x] 4.5 Cargar la relación de ubicación en `_base_query()` con `selectinload`, para evitar `MissingGreenlet` en la serialización async

## 5. Reintegro de sobrantes

- [x] 5.1 Crear en `repositories/inventory_log.py` el método que calcula el saldo pendiente de un despacho (`cantidad` menos la suma de reintegros que lo referencian)
- [x] 5.2 Crear el método que lista los despachos con saldo pendiente de un consumible, con proyecto, operario, fecha y saldo
- [x] 5.3 Implementar `reintegrar()` en `services/asset.py`: validar tenant, activo consumible, origen de tipo `entrega`, cantidad positiva y menor o igual al saldo; sumar stock y crear el log `reintegro` heredando `project_id` y `operario_id` del despacho
- [x] 5.4 Agregar `GET /api/v1/assets/{asset_id}/despachos-pendientes` y `POST /api/v1/assets/{asset_id}/reintegro`
- [x] 5.5 Incluir `origen_log_id` y la unidad del activo en `InventoryLogResponse` y en las consultas de `api/v1/inventory.py`
- [x] 5.6 Agregar el endpoint de consumo neto por proyecto (despachado menos reintegrado)

## 6. Importación y exportación Excel

- [x] 6.1 Agregar `ubicacion_rack`, `ubicacion_nivel`, `ubicacion_posicion` y `unidad` al final de `_COLUMNS` en `api/v1/import_assets.py`, sin alterar el orden existente
- [x] 6.2 Actualizar `_EXAMPLES` y los anchos de columna del template
- [x] 6.3 Resolver la terna rack/nivel/posición contra el catálogo, creando la ubicación si no existe y rechazando la fila si viene incompleta
- [x] 6.4 Devolver en la respuesta de importación el conteo de ubicaciones creadas
- [x] 6.5 Parsear y validar `unidad` en el importador
- [x] 6.6 Cambiar el parseo de `stock_actual` y `stock_minimo` a decimal con hasta tres decimales, aceptando coma o punto
- [x] 6.7 Precargar la ubicación y la unidad al exportar el template de un tenant con activos
- [x] 6.8 Verificar que un archivo con las nueve columnas antiguas sigue importándose sin error

## 7. Dashboard y consulta para agentes

- [x] 7.1 Ajustar `low-stock-detail` para devolver ubicación y unidad junto al stock
- [x] 7.2 Ajustar `inventory-last-days` para sumar cantidades decimales sin truncar
- [x] 7.3 Agregar ubicación y unidad a `AssetQueryResult` y a la consulta `GET /assets/query`

## 8. Frontend — ubicación y unidad

- [x] 8.1 Agregar los tipos de ubicación y unidad a `types/index.ts` y los métodos del catálogo a `services/api.ts`
- [x] 8.2 Crear `UbicacionPicker.tsx` con los tres selectores en cascada y la acción "Crear ubicación nueva" inline, con controles de mínimo 48px
- [ ] 8.3 Crear la pantalla de mantención del catálogo de ubicaciones (listar, crear, editar, eliminar)
- [x] 8.4 Agregar el bloque de ubicación a `ScanResult.tsx`, visible sólo cuando el activo tiene una asignada
- [x] 8.5 Mostrar el stock con su unidad y decimales en `ScanResult.tsx`
- [x] 8.6 Integrar `UbicacionPicker` y el selector de unidad en `EditAssetModal.tsx` y `AssetEdit.tsx`
- [ ] 8.7 Mostrar la ubicación en `Assets.tsx` y agregar el filtro por rack, respetando mobile-first y sin scroll horizontal
- [ ] 8.8 Mostrar ubicación y unidad en el panel de bajo stock del dashboard

## 9. Frontend — reintegro

- [x] 9.1 Crear `ReintegroModal.tsx` que liste los despachos pendientes del consumible y permita elegir uno e ingresar la cantidad, con botones de mínimo 48px
- [x] 9.2 Agregar la acción secundaria "Reintegrar sobrante" en `ScanResult.tsx`, habilitada sólo si hay despachos pendientes
- [x] 9.3 Conectar el modal en `Scanner.tsx` con su feedback de éxito y el reset del escaneo
- [x] 9.4 Agregar los métodos de despachos pendientes y reintegro a `services/api.ts`
- [ ] 9.5 Distinguir el movimiento `reintegro` en `Inventory.tsx`, mostrando a qué despacho corresponde

## 10. Cierre

- [ ] 10.1 Probar el flujo completo: despachar 100 m a un proyecto, reintegrar 20, verificar stock, saldo pendiente y consumo neto
- [ ] 10.2 Probar los rechazos: reintegro mayor al saldo, sobre un activo prestable y sobre un despacho de otro tenant
- [ ] 10.3 Probar el catálogo: terna duplicada, eliminación con activos asignados, renombrar un rack y verificar que los activos quedan reubicados
- [ ] 10.4 Revisar el workflow de n8n que consume `/assets/query` frente a los campos nuevos y las cantidades decimales
- [ ] 10.5 Actualizar `AGENTS.md` con el catálogo de ubicaciones, la unidad de medida y el movimiento de reintegro
