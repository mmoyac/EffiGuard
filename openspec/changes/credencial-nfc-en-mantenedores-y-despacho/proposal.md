## Why

El refactor de catálogo (`751ae7e`) reemplazó los modales de escáner por los de `components/catalogo/` y en el camino perdió los botones NFC. Hoy los modales de préstamo, entrega y devolución dicen literalmente **"Escanea la credencial del operario"** pero solo exponen un `input` de texto: desde un teléfono, sin lector HID, esa instrucción es imposible de cumplir. El mantenedor de usuarios del Super Admin quedó a medias — NFC al editar, campo pelado al crear.

Nada lo detectó porque ninguna spec lo exigía: el único requisito de NFC (`escaneo/spec.md`) está acotado a la página de escáner de catálogo. La captura de credencial en mantenedores y en despacho nunca estuvo escrita, así que borrarla no rompió ninguna spec.

La lectura NFC está verificada en producción: una tarjeta Bip! (MIFARE Classic) leída con Chrome Android en `https://effiguard-demo.effi4tech.cl/catalogo/scan` devuelve su `serialNumber`. El componente funciona; lo que falta es invocarlo donde corresponde.

## What Changes

- Reponer la captura por NFC en los tres modales de despacho: `ModalPrestamo`, `ModalEntrega` y `ModalDevolucion`. El campo de credencial pasa a ofrecer NFC además del ingreso por HID/tecleo que ya tiene.
- Completar el mantenedor del Super Admin (`AdminUsers`): el formulario de creación gana botón NFC y botón *Generar*, igualando al mantenedor de tenant (`Users`), que ya está completo y sirve de referencia.
- Extraer el control de captura de credencial a un componente único y reutilizable, para que la normalización del UID y el conjunto de métodos de captura dejen de estar copiados en cinco archivos. Es la causa raíz de que el refactor pudiera perderlos sin que se notara.
- Escribir la capacidad en spec, nombrando cada pantalla donde la captura de credencial es obligatoria. Sin esto, el próximo refactor la vuelve a perder en silencio.

No hay cambios de backend, de modelo de datos ni de migraciones: `GET /api/v1/users/scan/{uid_credencial}` ya resuelve la credencial y los tres modales ya lo llaman vía `usersApi.scanByCredential()`.

## Capabilities

### New Capabilities

- `captura-de-credencial`: El control de captura del `uid_credencial` de un usuario — qué métodos de entrada debe ofrecer (NFC, lector HID/tecleo, generación de QR propio, limpieza), cómo se normaliza el UID para que registro y lectura coincidan, y en qué pantallas es obligatorio ofrecerlo. Cubre tanto el alta de la credencial en los mantenedores como su lectura en los flujos de despacho.

### Modified Capabilities

Ninguna. El requisito existente `escaneo → Escaneo por NFC` sigue siendo cierto tal como está (la página de escáner ofrece NFC) y el endpoint de `escaneo → Escaneo de credencial de operario` no cambia. Lo que falta no es una modificación de comportamiento ya especificado, sino comportamiento de interfaz que nunca se especificó — de ahí que sea una capacidad nueva y no un delta.

## Impact

**Código afectado** (todo frontend):

- `frontend/src/components/catalogo/ModalPrestamo.tsx` — campo de credencial sin NFC
- `frontend/src/components/catalogo/ModalEntrega.tsx` — ídem
- `frontend/src/components/catalogo/ModalDevolucion.tsx` — ídem
- `frontend/src/pages/admin/AdminUsers.tsx` — formulario de creación incompleto
- `frontend/src/pages/Users.tsx` — se migra al componente compartido (hoy funciona, pero duplica la lógica)
- `frontend/src/components/scanner/NFCScanner.tsx` — se reutiliza sin cambios funcionales

**Sin impacto**: backend, base de datos, API, dependencias. No se agregan librerías: Web NFC es API del navegador y `NDEFReader` ya está tipado en el proyecto.

**Degradación conocida y aceptada**: Web NFC solo existe en Chrome sobre Android. En escritorio e iOS el botón NFC no se ofrece o informa que no hay soporte, y el lector HID, el tecleo manual y la lista de operarios siguen siendo la vía. Ninguna pantalla puede quedar dependiendo únicamente de NFC.
