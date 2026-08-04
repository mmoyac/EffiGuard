## 1. Backend

- [x] 1.1 Implementar en `repositories/asset.py` el cálculo del valor de existencias: stock por precio de compra sobre los consumibles
- [x] 1.2 Implementar el valor del parque de herramientas a valor de reposición, excluyendo las que están en estado Robado
- [x] 1.3 Calcular por activo la fecha del último movimiento, cayendo a `created_at` si nunca tuvo ninguno
- [x] 1.4 Devolver el detalle ordenado por valor descendente, acotado a los que concentran el valor
- [x] 1.5 Contar los activos sin precio ni valor de reposición
- [x] 1.6 Agregar `GET /api/v1/dashboard/valor-bodega` con su schema de respuesta

## 2. Frontend

- [x] 2.1 Agregar el tipo de respuesta a `Dashboard.tsx`
- [x] 2.2 Crear el panel con existencias y herramientas en líneas separadas
- [x] 2.3 Mostrar el detalle con el monto y los días sin movimiento de cada activo
- [x] 2.4 Permitir abrir el activo desde el detalle
- [x] 2.5 Mostrar la advertencia de activos sin precio cuando corresponda

## 3. Cierre

- [x] 3.1 Probar la valorización: consumible con stock y precio, herramienta con valor de reposición
- [x] 3.2 Probar que las herramientas robadas no se cuentan
- [x] 3.3 Probar que los activos sin precio se informan y no se suman como cero
- [x] 3.4 Probar la antigüedad: activo con movimientos recientes, antiguos y sin movimientos
