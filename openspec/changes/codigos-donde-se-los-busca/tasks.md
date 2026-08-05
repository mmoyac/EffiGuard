## 1. Extraer las piezas de códigos

- [x] 1.1 Mover `ChipCodigo` y `ModalCodigo` de `pages/Catalogo.tsx` a `components/catalogo/`, sin cambiar su comportamiento
- [x] 1.2 Crear `components/catalogo/SeccionCodigos.tsx` con el encabezado, los chips y el botón "Agregar", tomando lo que hoy está inline en `Catalogo.tsx:512-533`
- [x] 1.3 Montar `SeccionCodigos` en el panel desplegable de la variante, reemplazando el bloque inline y comprobando que se ve igual

## 2. Códigos desde "Editar variante"

- [x] 2.1 Montar `SeccionCodigos` al final de `ModalEditarVariante`, después de los campos de precio
- [x] 2.2 Verificar que agregar o borrar un código refresca las dos vistas: invalidar `productos` ya lo cubre, confirmar que el modal abierto lo refleja
- [x] 2.3 Comprobar el reemplazo completo del principal sin cerrar el modal: agregar, marcar con ★, borrar el viejo

## 3. Proveedor según el tipo

- [x] 3.1 En `ModalCodigo`, mostrar el campo de proveedor sólo para `proveedor` y `empaque`
- [x] 3.2 Al cambiar a un tipo que no admite proveedor, limpiar `proveedor_id` y `nuevoProveedor` del estado, para no enviar un dato que el usuario dejó de ver
- [x] 3.3 Revisar el texto de ayuda de cada tipo ahora que el campo aparece y desaparece, en especial el de `fabricante` que hoy contradice al campo de abajo

## 4. Alta de código desde el escáner

- [x] 4.1 En `EscanearCatalogo`, al recibir 404 dejar de limpiar a los 4 segundos y ofrecer "Asociar este código"
- [x] 4.2 Paso de selección de variante reusando la búsqueda del catálogo por nombre de producto o variante
- [x] 4.3 Abrir `ModalCodigo` con el código escaneado precargado y bloqueado, sobre la variante elegida
- [x] 4.4 Tras asociar, reintentar la resolución del código para que el flujo siga en la acción operativa que corresponda
- [x] 4.5 Manejar el 409 "ya está registrado en otro item" mostrando el mensaje del backend, sin dejar el modal en un estado ambiguo

## 5. Cámara para códigos 1D

- [x] 5.1 En `CameraScanner`, reemplazar el `qrbox` fijo de 200×200 por una función del viewport que devuelva una ventana ancha y baja, con tope para pantallas grandes
- [x] 5.2 No declarar `formatsToSupport`: omitirlo es lo que habilita todos los formatos
- [x] 5.3 Ajustar las esquinas decorativas del overlay, hoy fijas en `w-48 h-48`, para que acompañen la nueva ventana en vez de mentir sobre dónde apuntar

## 6. Verificación

- [x] 6.1 `npm run build` sin errores de TypeScript, atento a imports colgando tras las mudanzas de la tarea 1
- [ ] 6.2 Corregir en el demo los dos códigos `fabricante` con proveedor (ids 27 y 28 de la variante 5) usando el flujo nuevo, y borrar el de prueba si corresponde
- [ ] 6.3 Escanear con la cámara un EAN13 real y un QR en el mismo dispositivo, confirmando que ninguno de los dos empeoró
- [ ] 6.4 Escanear un código inexistente y completar el alta desde el escáner hasta llegar a la acción operativa
- [ ] 6.5 Revisar en móvil de 320px que el modal de edición con la sección de códigos no genera scroll horizontal
