## Context

La captura del `uid_credencial` está hoy copiada a mano en cinco archivos. Cada copia decide por su cuenta qué métodos ofrece, y por eso divergieron:

| Pantalla | NFC | Manual | Generar | Limpiar |
|---|---|---|---|---|
| `pages/Users.tsx` — crear | ✅ | ✅ | ✅ | — |
| `pages/Users.tsx` — editar | ✅ | ✅ | ✅ | ✅ |
| `pages/admin/AdminUsers.tsx` — crear | ❌ | ✅ | ❌ | ❌ |
| `pages/admin/AdminUsers.tsx` — editar | ✅ | ✅ | ✅ | ✅ |
| `catalogo/ModalPrestamo.tsx` | ❌ | ✅ | n/a | n/a |
| `catalogo/ModalEntrega.tsx` | ❌ | ✅ | n/a | n/a |
| `catalogo/ModalDevolucion.tsx` | ❌ | ✅ | n/a | n/a |

`generateUid()` también está duplicado íntegro en `Users.tsx:44` y `AdminUsers.tsx:27`.

El refactor de catálogo (`751ae7e`) reemplazó `scanner/LoanModal.tsx`, `ConsumableModal.tsx` y `ReturnModal.tsx` —que sí montaban `NFCScanner`— por los modales de `components/catalogo/`, reescritos desde cero. Al no existir un componente compartido, la captura NFC no se arrastró sola, y al no existir spec, nada la echó de menos.

Las piezas que ya funcionan y no se tocan: `components/scanner/NFCScanner.tsx` (verificado con tarjeta Bip! en Chrome Android contra el demo), `GET /api/v1/users/scan/{uid_credencial}` y `usersApi.scanByCredential()`.

## Goals / Non-Goals

**Goals:**

- Un solo componente de captura de credencial, montado por las siete ubicaciones de la tabla.
- NFC disponible en los tres modales de despacho y en el alta del mantenedor del Super Admin.
- Que la normalización del UID quede en un solo lugar, para que lo registrado y lo leído coincidan bajo el match exacto del backend.
- Que la próxima reescritura de una pantalla no pueda perder la captura sin romper una spec.

**Non-Goals:**

- Cambios de backend, de modelo de datos o de migraciones. El endpoint de resolución ya existe y su comportamiento no cambia.
- Escribir tags NFC. Solo se lee el `serialNumber`; la Bip! se usa tal como viene y no se le graba nada.
- Sustituir el lector HID o la lista de operarios. NFC se suma a lo que hay, no lo reemplaza.
- Emitir credenciales físicas nuevas o cambiar el formato del UID generado.
- Unificar el escaneo de **códigos de producto** (`EscanearCatalogo`) con el de credenciales. Son dominios distintos: uno resuelve un artículo, el otro una persona.

## Decisions

### 1. Un componente `CampoCredencial`, no un hook

Se crea `frontend/src/components/credencial/CampoCredencial.tsx`: input + botonera + panel NFC, todo junto.

Un hook (`useCapturaCredencial`) dejaría el markup en cada llamador, que es exactamente lo que divergió. Lo que hay que compartir es la interfaz, no solo la lógica.

Vive en `components/credencial/` y no en `components/scanner/` porque lo usan los mantenedores, que no tienen nada que ver con el escáner de catálogo; ni en `components/catalogo/shared.tsx`, porque un mantenedor de usuarios importando del catálogo es la clase de dependencia cruzada que el propio `shared.tsx` documenta querer evitar.

`generateUid()` se muda a este módulo y se borra de las dos páginas.

### 2. API: valor controlado + `onCapturar`

```
valor: string                      // texto del input, controlado por el padre
onChange: (v: string) => void
onCapturar: (uid: string) => void  // UID confirmado: Enter, lectura NFC o Generar
error?: string
permitirGenerar?: boolean          // mantenedores sí; despacho no
permitirLimpiar?: boolean
autoFocus?: boolean
label?: string
```

`onCapturar` es el punto donde los dos modos de uso divergen, y es lo único que divergen:

- **Mantenedor** — escribe el UID en el formulario. No consulta al backend: la credencial se valida al guardar, donde el 400 de credencial duplicada ya está manejado.
- **Despacho** — llama `usersApi.scanByCredential(uid)` y confirma al operario en pantalla.

Se descartó que el componente resolviera la credencial internamente: obligaría a los mantenedores a pasar un flag para desactivar una llamada que no quieren, y `ModalDevolucion` necesita el `id` resuelto para su propia validación contra `prestamo.user_id`, no solo el nombre.

### 3. Normalización: `trim()` siempre; mayúsculas solo en el UID de origen NFC

El `serialNumber` del tag se normaliza a mayúsculas en el punto donde nace, dentro del componente. El texto tecleado solo se recorta.

La alternativa —mayúsculas a todo— se descartó: el backend resuelve por coincidencia exacta, así que uppercase sobre lo tecleado rompería cualquier credencial ya almacenada en minúsculas. Arreglar eso pidiendo un match case-insensitive en el repositorio metería backend en el alcance y cambiaría el comportamiento ya especificado en `escaneo → Escaneo de credencial de operario`, a cambio de nada: los UID generados salen en mayúsculas por construcción y el UID de NFC recibe el mismo trato en el alta y en la lectura, que es donde la coincidencia importa.

### 4. NFC bajo demanda, con un solo panel abierto a la vez

El panel NFC se monta solo al pulsar su botón (`active` de `NFCScanner` atado a ese estado) y se cierra al leer. Abrir el lector al montar la pantalla gastaría batería en un turno completo y capturaría tags por accidente al apoyar el teléfono.

Donde convive con la cámara —`EscanearCatalogo`— abrir uno cierra el otro, como ya hace `LoanModal` en el código previo.

### 5. El input real se mantiene, y con él el capturador HID

`ModalEntrega.tsx:26-29` documenta que el capturador HID global ignora las teclas mientras el foco está en un input, y que por eso la ráfaga del lector cae en el campo de credencial en vez de interpretarse como código de producto. El componente conserva un `<input>` de verdad con `autoFocus` y el `onKeyDown` de Enter: ese comportamiento no es un detalle de estilo, es lo que evita que un préstamo se lea como un escaneo de catálogo.

### 6. Altura táctil a 48px

Los botones actuales de credencial usan `min-h-[44px]` (`Users.tsx:198`, `AdminUsers.tsx:267`), bajo el mínimo de 48px que fija AGENTS.md y que `catalogo/shared.tsx` ya respeta. El componente unificado adopta 48px, y al centralizarse deja de ser un valor que corregir en cinco lugares.

## Risks / Trade-offs

**Regresión al migrar `Users.tsx`, que hoy funciona** → Es la pantalla de referencia y la única con la captura completa. Se migra al final, después de que el componente esté probado en los modales de despacho, para no romper lo único que sirve mientras se arregla el resto.

**Web NFC solo existe en Chrome sobre Android** → Ya cubierto por `NFCScanner`, que degrada con un mensaje explícito. La spec exige además que ninguna pantalla dependa solo de NFC: en despacho quedan el lector HID, el tecleo y la lista de operarios; en mantenedores, el tecleo y *Generar*.

**Web NFC exige HTTPS** → El despliegue ya es HTTPS con wildcard `*.effi4tech.cl`. En desarrollo local sobre `http://` el botón informará falta de soporte; la prueba real se hace contra el demo, como ya se hizo.

**Distintos tipos de tarjeta devuelven `serialNumber` con formatos distintos** → Mientras el alta y la lectura pasen por el mismo componente, ambas producen la misma cadena y coinciden. Una credencial dada de alta tecleando el UID de una tarjeta leído con otra herramienta puede no coincidir; el camino soportado es darla de alta acercándola.

**Siete llamadores por migrar en un solo change** → Son mecánicos y del mismo tipo. El orden de `tasks.md` los deja verificables uno a uno: primero el componente, después los tres modales de despacho (lo que está roto), después el mantenedor incompleto, y al final la migración de la pantalla que ya funciona.

## Migration Plan

No hay datos que migrar: ningún `uid_credencial` almacenado cambia de valor y el endpoint de resolución sigue igual. El despliegue es el del frontend, y el rollback es revertir el commit — no queda estado nuevo detrás.

## Open Questions

Ninguna bloqueante. Queda anotado, fuera de alcance, que las tarjetas Bip! son nominativas del trabajador y no de la empresa: si un operario cambia de tarjeta hay que reasignarla en el mantenedor, y ese es justamente el flujo que este change deja utilizable desde el teléfono.
