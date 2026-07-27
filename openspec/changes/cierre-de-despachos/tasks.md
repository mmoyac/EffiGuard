## 1. Backend — despachos abiertos

- [x] 1.1 Filtrar en `despachos_pendientes()` los despachos que ya tienen un reintegro, en vez de mostrarlos mientras quede saldo
- [x] 1.2 Filtrar los despachos cuyo proyecto está desactivado, dejando pasar los que no tienen proyecto
- [x] 1.3 Verificar que el cálculo de consumo por proyecto no cambia con ninguno de los dos filtros

## 2. Backend — reintegro único

- [x] 2.1 Rechazar con 400 el reintegro sobre un despacho que ya tiene uno, indicando que la entrega está cerrada
- [x] 2.2 Rechazar con 400 el reintegro sobre un despacho de proyecto desactivado, indicando que la obra está cerrada
- [x] 2.3 Mantener la validación de que la cantidad no supere lo despachado

## 3. Frontend — confirmación

- [x] 3.1 Agregar en `ReintegroModal.tsx` el resumen previo: cuánto vuelve, cuánto queda como consumo y de qué proyecto
- [x] 3.2 Advertir explícitamente que la entrega se cierra y que la operación no se puede deshacer
- [x] 3.3 Ajustar el texto de la lista para hablar de entregas abiertas

## 4. Cierre

- [x] 4.1 Probar el flujo: despachar 100, reintegrar 20, verificar que el despacho desaparece de la lista y el consumo queda en 80
- [x] 4.2 Probar el rechazo del segundo reintegro sobre el mismo despacho
- [x] 4.3 Probar que desactivar el proyecto saca sus despachos de la lista y que reactivarlo los devuelve
- [x] 4.4 Probar que un despacho sin proyecto permanece disponible para reintegro
