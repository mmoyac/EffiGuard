## 1. Modelo y migración

- [x] 1.1 Agregar `precio_compra` (`Numeric(12,2)`, nulo) a `models/asset.py`
- [x] 1.2 Agregar `costo_unitario` (`Numeric(12,4)`, nulo) a `models/inventory_log.py`
- [x] 1.3 Crear la migración Alembic `019_costo_materiales` con ambas columnas, sin backfill
- [x] 1.4 Aplicar y verificar que los activos y movimientos existentes quedan sin costo

## 2. Backend — captura del costo

- [x] 2.1 Agregar `precio_compra` a `AssetCreate`, `AssetUpdate` y `AssetResponse`, validando que sea mayor a 0
- [x] 2.2 Estampar `costo_unitario` con el `precio_compra` vigente en un punto único, para que ningún movimiento lo omita por olvido
- [x] 2.3 Exponer `costo_unitario` y el costo total del movimiento en `InventoryLogResponse`

## 3. Backend — cálculo del costeo

- [x] 3.1 Implementar en `repositories/inventory_log.py` el costo de consumo por proyecto: entregas menos reintegros, valorizados
- [x] 3.2 Implementar el costo de pérdidas, usando valor de reposición para prestables y costo unitario para consumibles
- [x] 3.3 Implementar el costo de mermas
- [x] 3.4 Contar los movimientos sin valorizar en cada línea
- [x] 3.5 Agregar `GET /api/v1/dashboard/costo-materiales-por-proyecto` con las tres líneas separadas
- [x] 3.6 Filtrar a proyectos activos y ordenar por gasto acumulado descendente

## 4. Importación Excel

- [x] 4.1 Agregar `precio_compra` al final de `_COLUMNS`, sin alterar el orden existente
- [x] 4.2 Actualizar `_EXAMPLES` y los anchos de columna
- [x] 4.3 Parsear y validar la columna, reportando error de fila si no es un número positivo
- [x] 4.4 Precargar el precio al exportar el template
- [ ] 4.5 Verificar que un archivo del template anterior sigue importándose sin error

## 5. Frontend

- [x] 5.1 Agregar `precio_compra` y el costo del movimiento a `types/index.ts`
- [x] 5.2 Agregar precio de compra a los formularios de consumible, con el helper que acepta el precio del empaque y lo divide
- [x] 5.3 Crear el panel de gasto por proyecto activo en `Dashboard.tsx`, ordenado de mayor a menor y titulado como materiales, no como costo del proyecto
- [x] 5.4 Permitir desplegar el desglose de las tres líneas sin salir del dashboard
- [x] 5.5 Mostrar la advertencia de movimientos no valorizados cuando corresponda
- [x] 5.6 Mostrar el costo del movimiento en `Inventory.tsx`

## 6. Cierre

- [x] 6.1 Probar el congelamiento: costear un consumo, cambiar el precio del activo y verificar que el costo histórico no se mueve
- [x] 6.2 Probar el consumo neto valorizado: despachar 100 a $120, reintegrar 20, verificar $9.600
- [x] 6.3 Probar la valorización de pérdidas: herramienta a valor de reposición, consumible a costo unitario
- [x] 6.4 Probar que los movimientos sin precio se reportan como no valorizados y no como cero
- [ ] 6.5 Actualizar `AGENTS.md` con el modelo de costo de materiales
