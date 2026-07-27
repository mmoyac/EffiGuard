## 1. Modelo de datos y migración

- [x] 1.1 Agregar `codigo_fabricante` (`String(50)`, nulo, indexado, no único) a `models/asset.py`
- [x] 1.2 Crear la migración Alembic que agrega la columna con su índice
- [x] 1.3 En la misma migración, eliminar la constraint `UNIQUE` global de `uid_fisico` y crear `UNIQUE (tenant_id, uid_fisico)`
- [x] 1.4 Escribir el `downgrade()` documentando que recrear la constraint global falla si dos tenants comparten un mismo código
- [x] 1.5 Verificar la migración corriendo `alembic upgrade head` y comprobando que dos tenants pueden cargar el mismo `uid_fisico`

## 2. Backend — código de fabricante

- [x] 2.1 Agregar `codigo_fabricante` a `AssetCreate`, `AssetUpdate` y `AssetResponse` en `schemas/asset.py`
- [x] 2.2 Normalizar el código a mayúsculas sin espacios extremos al crear y actualizar
- [x] 2.3 Agregar `get_by_codigo_fabricante()` a `AssetRepository`, devolviendo todas las coincidencias del tenant
- [x] 2.4 Ajustar el mensaje de conflicto de UID duplicado para que refleje que la unicidad es dentro del tenant

## 3. Backend — resolución de escaneo

- [x] 3.1 Definir en `schemas/asset.py` el sobre de resolución con sus variantes `unico` y `multiple`
- [x] 3.2 Reescribir `scan_asset()` en `services/asset.py`: buscar por `uid_fisico`, luego por `codigo_fabricante`, y devolver el sobre según la cantidad de coincidencias
- [x] 3.3 Ordenar las candidatas poniendo primero las Disponibles, luego las En Terreno y al final el resto
- [x] 3.4 Incluir en cada candidata el nombre, UID, estado y ubicación en bodega
- [x] 3.5 Actualizar `GET /assets/scan/{codigo}` al nuevo `response_model`, manteniendo el 404 cuando no hay coincidencias

## 4. Backend — alta de unidades por código

- [x] 4.1 Implementar en `services/asset.py` el alta que clona la unidad más reciente con el código dado, sin heredar la ubicación
- [x] 4.2 Generar un `uid_fisico` por unidad reutilizando el generador `EFG-XXXXXXXX` del importador, extrayéndolo a un helper compartido
- [x] 4.3 Agregar `POST /api/v1/assets/from-codigo-fabricante` recibiendo código y cantidad, y devolviendo las unidades creadas
- [x] 4.4 Responder 404 cuando el código no corresponde a ninguna unidad del tenant
- [x] 4.5 Agregar un endpoint de vista previa que, dado un código, devuelva el producto a clonar y cuántas unidades existen

## 5. Importación Excel

- [x] 5.1 Agregar `codigo_fabricante` al final de `_COLUMNS` en `api/v1/import_assets.py`, sin alterar el orden existente
- [x] 5.2 Actualizar `_EXAMPLES` y los anchos de columna del template
- [x] 5.3 Parsear y normalizar la columna en el importador
- [x] 5.4 Eliminar la validación cruzada contra UID de otros tenants y su mensaje de error, que ya no aplica
- [x] 5.5 Precargar el código de fabricante al exportar el template de un tenant con activos
- [x] 5.6 Verificar que un archivo generado con el template anterior sigue importándose sin error

## 6. Frontend — resolución y selección

- [x] 6.1 Agregar el tipo del sobre de resolución y `codigo_fabricante` a `types/index.ts`
- [x] 6.2 Adaptar `assetsApi.scan()` en `services/api.ts` al nuevo contrato
- [x] 6.3 Adaptar `handleScan()` en `Scanner.tsx` para distinguir resolución única de múltiple
- [x] 6.4 Crear `CandidatosModal.tsx` con la lista de unidades candidatas —UID, estado y ubicación— y controles de mínimo 48px
- [x] 6.5 Al elegir una candidata, cargar su préstamo activo y continuar con el flujo de acción contextual existente
- [x] 6.6 Mostrar el código de fabricante en `ScanResult.tsx`, diferenciado visualmente del UID

## 7. Frontend — código de fabricante y alta rápida

- [x] 7.1 Agregar el campo de código de fabricante en `EditAssetModal.tsx` y `AssetEdit.tsx`
- [ ] 7.2 Mostrar el código en `Assets.tsx`, respetando mobile-first y sin scroll horizontal
- [ ] 7.3 Crear el flujo de alta rápida: escanear código, mostrar el producto identificado y cuántas unidades existen, elegir cantidad y confirmar
- [ ] 7.4 Ofrecer la impresión de etiquetas de las unidades recién creadas desde `printLabel.ts`
- [ ] 7.5 Ofrecer el alta manual con el código precargado cuando el código no se reconoce

## 8. Cierre

- [ ] 8.1 Probar el flujo de compra: escanear el código de un producto con 3 unidades, crear una cuarta e imprimir su etiqueta
- [x] 8.2 Probar la resolución múltiple: escanear un código de fábrica compartido y verificar el orden y la selección de candidatas
- [x] 8.3 Probar la precedencia: un código que es UID de un consumible y código de fabricante de otras herramientas resuelve el consumible
- [x] 8.4 Probar que dos tenants pueden cargar el mismo `uid_fisico` sin interferirse
- [ ] 8.5 Actualizar `AGENTS.md` con el código de fabricante y la unicidad de UID por tenant
