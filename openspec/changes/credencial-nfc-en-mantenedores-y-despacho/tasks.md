## 1. Componente compartido

- [x] 1.1 Crear `frontend/src/components/credencial/CampoCredencial.tsx` con la API definida en design.md: `valor`, `onChange`, `onCapturar`, `error`, `permitirGenerar`, `permitirLimpiar`, `autoFocus`, `label`
- [x] 1.2 Mover `generateUid()` a ese módulo y exportarlo, sin cambiar el alfabeto sin caracteres ambiguos ni el formato `PREFIJO-XXXXXXXX`
- [x] 1.3 Montar `NFCScanner` bajo demanda: se activa al pulsar el botón NFC y se cierra al leer un tag
- [x] 1.4 Normalizar en un solo punto: `trim()` a todo lo capturado, y mayúsculas solo al `serialNumber` que llega de NFC
- [x] 1.5 Conservar el `<input>` real con `autoFocus` y `onKeyDown` de Enter, para no romper el capturador HID global que ignora teclas mientras el foco está en un input
- [x] 1.6 Usar `min-h-[48px]` en input y botones, conforme al mínimo táctil de AGENTS.md

## 2. Flujos de despacho (lo que está roto)

- [x] 2.1 Reemplazar el campo de credencial de `catalogo/ModalPrestamo.tsx` por `CampoCredencial`, con `onCapturar` llamando a `resolverCredencial`
- [x] 2.2 Ídem en `catalogo/ModalEntrega.tsx`
- [x] 2.3 Ídem en `catalogo/ModalDevolucion.tsx`, verificando que `confirmadoId` se siga poblando para la validación contra `prestamo.user_id`
- [x] 2.4 Confirmar que en los tres modales sigue disponible la vía alternativa (lector HID, tecleo y lista de operarios) y que `permitirGenerar` queda desactivado: en despacho no se emiten credenciales

## 3. Mantenedor del Super Admin

- [x] 3.1 Reemplazar el input pelado `"UID credencial (opcional)"` del formulario de creación de `pages/admin/AdminUsers.tsx` por `CampoCredencial` con `permitirGenerar`
- [x] 3.2 Migrar el modal de edición de esa misma página al componente compartido y borrar su estado `nfcEditOpen` y su copia local de `generateUid()`

## 4. Migración de la pantalla que ya funciona

- [x] 4.1 Migrar el formulario de creación y el modal de edición de `pages/Users.tsx` a `CampoCredencial`, verificando que no se pierde ninguna de las cuatro acciones que hoy ofrece
- [x] 4.2 Borrar la copia local de `generateUid()` y los estados `nfcCreateOpen` / `nfcEditOpen` de `pages/Users.tsx`
- [x] 4.3 Verificar que ningún archivo conserva lógica propia de captura: `grep -rn "NDEFReader\|generateUid\|NFCScanner" frontend/src` debe arrojar solo `NFCScanner.tsx`, `CampoCredencial.tsx` y `EscanearCatalogo.tsx`

## 5. Verificación

- [x] 5.1 `npm run build` en `frontend/` sin errores de TypeScript
- [ ] 5.2 Probar en Chrome sobre Android contra el demo: dar de alta una credencial acercando una tarjeta Bip! en el mantenedor de usuarios del tenant
- [ ] 5.3 Con esa misma tarjeta, completar un préstamo, una entrega de consumible y una devolución leyendo la credencial por NFC
- [ ] 5.4 Verificar la degradación en un navegador de escritorio: el control informa que no hay soporte NFC y el despacho se completa igual con tecleo y con la lista de operarios
- [ ] 5.5 Revisar las siete ubicaciones en móvil de 320px: sin scroll horizontal y con los botones sobre 48px
