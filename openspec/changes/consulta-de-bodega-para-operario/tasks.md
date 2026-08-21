## 1. Backend — consulta de bodega

- [x] 1.1 `schemas/bodega.py`: `UbicacionBodega` (rack, nivel, posición, ejemplares) e `ItemBodega` (producto, variante, comportamiento, unidad, disponibilidad cruda, `disponibilidad_texto`, `hay_stock`, ubicaciones), sin ningún campo de precio ni valorización
- [x] 1.2 `VarianteRepository.buscar_para_bodega(texto, limit)`: `ilike` sobre nombre de producto y de variante, `OR` igualdad exacta sobre `codigos.codigo`, aciertos por código primero, resto por producto y variante
- [x] 1.3 `UnidadRepository.ubicaciones_disponibles(variante_ids)`: una sola query agregada de unidades en estado 1 con su ubicación, agrupada por variante y posición
- [x] 1.4 `services/bodega.py`: armar el `disponibilidad_texto` según el `comportamiento` de la familia — stock + unidad para consumibles, "N de M disponibles" para prestables
- [x] 1.5 `services/bodega.py`: resolver la ubicación efectiva con precedencia unidad → variante, y devolver "sin ubicación asignada" explícito cuando ambas son nulas
- [x] 1.6 `api/v1/bodega.py`: `GET /api/v1/bodega/buscar?q=`, abierto a cualquier rol autenticado del tenant, mínimo 2 caracteres (422 bajo el umbral) y límite 50
- [x] 1.7 Registrar el router en `api/v1/router.py`

## 2. Migración de menú y permisos

- [x] 2.1 `028_menu_bodega_operario.py`: alta del `menu_item` "Mis Préstamos" (`/my-loans`, módulo Préstamos) y "Bodega" (`/bodega`, módulo Inventario)
- [x] 2.2 Permisos: operario sobre "Mis Préstamos" y "Bodega"; bodeguero y admin sobre "Bodega"
- [x] 2.3 Baja del permiso del operario sobre "Escanear" (`/catalogo/scan`)
- [x] 2.4 `downgrade` que restituye el estado previo, incluido el permiso del operario sobre "Escanear"

## 3. Frontend — pantalla Bodega

- [x] 3.1 Tipos `ItemBodega` y `UbicacionBodega` en `types/index.ts`, y la llamada en `services/api.ts`
- [x] 3.2 `pages/Bodega.tsx`: campo de búsqueda único, enfocado al entrar, con debounce
- [x] 3.3 Tarjeta de resultado: nombre del item, disponibilidad y ubicación visibles sin abrir nada; atenuada con "Sin stock" cuando no hay
- [x] 3.4 Prestable con ejemplares en varias posiciones: listar cada ubicación con su conteo
- [x] 3.5 Estados vacíos distintos para "no está en catálogo" y "existe pero sin stock"
- [ ] 3.6 Verificar 320px sin scroll horizontal y controles de 48px

## 4. Frontend — alcance del rol

- [x] 4.1 `RoleRoute` en `App.tsx`: roles permitidos declarados junto a cada ruta, redirigiendo a la pantalla de entrada del rol cuando no corresponde
- [x] 4.2 Cerrar al operario `/catalogo`, `/catalogo/scan`, `/proveedores`, `/loans`, `/inventory`, `/users`, `/projects`, `/ubicaciones` y `/admin/*`
- [x] 4.3 Registrar la ruta `/bodega`, abierta a todos los roles autenticados

## 5. Verificación

- [x] 5.1 Búsqueda por nombre parcial → devuelve las variantes del tenant, ordenadas
- [x] 5.2 Búsqueda por código exacto de una caja → esa variante encabeza el resultado
- [x] 5.3 Búsqueda de 1 carácter → 422
- [x] 5.4 Consumible con stock → "240 un" y su rack, nivel y posición
- [x] 5.5 Prestable con 3 de 7 libres en dos racks → "3 de 7 disponibles" y ambas ubicaciones con su conteo
- [x] 5.6 Variante sin ubicación en variante ni unidad → "sin ubicación asignada"
- [x] 5.7 Variante con stock cero → aparece en el resultado, marcada sin stock
- [x] 5.8 Respuesta inspeccionada: ningún campo de precio ni valorización, con cualquier rol
- [x] 5.9 Material de otro tenant → no aparece
- [x] 5.10 Menú del operario → exactamente "Mis Préstamos" y "Bodega"
- [ ] 5.11 Operario tipeando `/catalogo/scan` o `/users` → redirigido a `/my-loans`
- [x] 5.12 `alembic downgrade -1` → el menú vuelve al estado previo
