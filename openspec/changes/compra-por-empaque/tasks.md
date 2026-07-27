## 1. Modelo y migración

- [x] 1.1 Agregar `contenido_por_empaque` (`Numeric(12,3)`, nulo) y `nombre_empaque` (`String(20)`, nulo) a `models/asset.py`
- [x] 1.2 Crear la migración Alembic `018_contenido_por_empaque` con ambas columnas, sin backfill
- [x] 1.3 Aplicar y verificar que los activos existentes quedan sin empaque y siguen comprándose por unidad

## 2. Backend

- [x] 2.1 Agregar ambos campos a `AssetCreate`, `AssetUpdate` y `AssetResponse`, validando que el contenido sea mayor a 0
- [x] 2.2 Cambiar `AssetPurchase` a `cantidad` y `empaques` opcionales, con validación de que venga exactamente uno
- [x] 2.3 En `purchase_stock()`, resolver los empaques a unidades y rechazar `empaques` si el activo no tiene contenido configurado
- [x] 2.4 Anteponer la constancia del empaque a la observación del movimiento
- [x] 2.5 Verificar que el log queda con la cantidad en unidades de stock, no en empaques

## 3. Importación Excel

- [x] 3.1 Agregar `contenido_por_empaque` y `nombre_empaque` al final de `_COLUMNS`, sin alterar el orden existente
- [x] 3.2 Actualizar `_EXAMPLES` y los anchos de columna
- [x] 3.3 Parsear y validar ambas columnas, reportando error de fila si el contenido no es un número positivo
- [x] 3.4 Precargar la configuración de empaque al exportar el template
- [x] 3.5 Verificar que un archivo del template anterior sigue importándose sin error

## 4. Frontend

- [x] 4.1 Agregar ambos campos a `types/index.ts`
- [x] 4.2 Agregar la configuración de empaque en `EditAssetModal.tsx` y `AssetEdit.tsx`, visible sólo para familias consumibles
- [x] 4.3 Crear el helper de equivalencia que formatea "9.000 un. (90 cajas)" con un decimal cuando no calza
- [x] 4.4 Mostrar la equivalencia en `ScanResult.tsx` y en `Assets.tsx`

## 5. Cierre

- [x] 5.1 Probar el flujo: caja de 100 tornillos, comprar 3 cajas, verificar stock 300 y log en unidades
- [x] 5.2 Probar los rechazos: ambos campos, ninguno, empaques sin contenido configurado, cantidad cero
- [x] 5.3 Probar el rollo de 100 metros con la misma mecánica sobre un consumible medido
- [ ] 5.4 Actualizar `AGENTS.md` con el contenido por empaque
