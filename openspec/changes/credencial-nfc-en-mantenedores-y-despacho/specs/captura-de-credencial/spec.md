## ADDED Requirements

### Requirement: Control único de captura de credencial

Toda pantalla que capture el `uid_credencial` de un usuario SHALL hacerlo a través de un único componente compartido. Ninguna pantalla SHALL implementar por su cuenta la lectura NFC, la generación de UID ni la normalización del valor capturado.

La lógica duplicada en cinco archivos es la razón por la que el refactor de catálogo pudo borrar la captura por NFC de tres pantallas sin que nada fallara.

#### Scenario: Alta de una pantalla nueva que pide credencial

- **WHEN** se agrega una pantalla que necesita capturar la credencial de un usuario
- **THEN** monta el componente compartido y obtiene NFC, ingreso manual y normalización sin escribir código de captura

#### Scenario: Cambio en el conjunto de métodos de captura

- **WHEN** se modifica el componente compartido
- **THEN** el cambio aplica a todas las pantallas de mantenedor y de despacho a la vez, sin editar cada una

### Requirement: Captura de credencial por NFC

El control de captura de credencial SHALL ofrecer la lectura del tag NFC del usuario mediante la Web NFC API, tomando el `serialNumber` del tag como `uid_credencial`. Esto cubre las tarjetas de transporte de uso cotidiano en Chile — la tarjeta Bip! —, que el operario ya lleva encima y no hay que comprar ni emitir.

La lectura NFC SHALL activarse solo a petición explícita del usuario, nunca al montar la pantalla: mantener el lector abierto sin que nadie lo haya pedido consume batería y captura tags por accidente.

#### Scenario: Tag leído

- **WHEN** el usuario activa la lectura NFC y acerca su tarjeta al dispositivo
- **THEN** el `serialNumber` del tag queda como valor del campo de credencial y la lectura se cierra

#### Scenario: Navegador sin soporte Web NFC

- **WHEN** `NDEFReader` no existe en `window`
- **THEN** el control informa que el dispositivo o navegador no soporta NFC, y los demás métodos de captura siguen operativos

#### Scenario: Permiso de NFC denegado

- **WHEN** el navegador rechaza el permiso de NFC
- **THEN** el control explica cómo habilitarlo y ofrece reintentar, sin bloquear el resto del formulario

### Requirement: Normalización única del UID capturado

El `uid_credencial` SHALL normalizarse con la misma regla en el alta y en la lectura, dentro del componente compartido. Como `GET /api/v1/users/scan/{uid_credencial}` resuelve por coincidencia exacta, dos normalizaciones distintas producirían una credencial que se registra pero nunca se encuentra.

#### Scenario: Ida y vuelta de un mismo tag

- **WHEN** un tag se registra por NFC en el mantenedor y luego se lee por NFC en un flujo de despacho
- **THEN** ambas capturas producen exactamente la misma cadena y el endpoint de resolución encuentra al usuario

### Requirement: Alta de credencial en los mantenedores de usuarios

El mantenedor de usuarios del administrador de tenant y el del Super Admin SHALL ofrecer la captura de credencial tanto al **crear** como al **editar** un usuario. Ambas pantallas SHALL ofrecer los mismos métodos: lectura NFC, ingreso manual, generación de un UID propio y limpieza del valor.

Un mantenedor donde solo se puede asignar la credencial al editar obliga a crear el usuario, guardarlo y volver a abrirlo — tres pasos para un dato que se captura acercando una tarjeta.

#### Scenario: Alta de usuario con su tarjeta

- **WHEN** el administrador crea un usuario y acerca la tarjeta del operario al activar NFC
- **THEN** el `uid_credencial` queda cargado en el formulario de creación y se guarda junto con el resto del usuario

#### Scenario: Usuario sin tarjeta física

- **WHEN** el administrador genera un UID propio en lugar de leer un tag
- **THEN** el sistema produce un código corto sin caracteres ambiguos, apto para imprimirse como QR de empleado

#### Scenario: Credencial ya asignada a otro usuario

- **WHEN** se guarda un `uid_credencial` que ya usa otro usuario del tenant
- **THEN** el mantenedor muestra "Esa credencial ya está asignada a otro usuario" y el formulario conserva lo escrito

### Requirement: Lectura de credencial en los flujos de despacho

Todo flujo que identifique al operario por su credencial SHALL ofrecer la lectura por NFC junto al ingreso por lector HID o tecleo. Esto aplica al registro de préstamo, a la entrega de consumible a operario y a la devolución de un ejemplar.

Estas pantallas ya instruyen "Escanea la credencial del operario"; sin NFC esa instrucción no se puede cumplir desde un teléfono, que es el dispositivo con el que se despacha en obra.

#### Scenario: Préstamo identificando al operario por NFC

- **WHEN** el bodeguero registra un préstamo y lee la credencial del operario por NFC
- **THEN** el UID se resuelve contra el endpoint de credencial y el nombre del receptor queda confirmado en pantalla

#### Scenario: Entrega de consumible identificando al operario por NFC

- **WHEN** el bodeguero entrega un consumible y lee la credencial del operario por NFC
- **THEN** el operario queda seleccionado como quien retira, sin recorrer la lista de nombres

#### Scenario: Devolución identificando al operario por NFC

- **WHEN** el operario devuelve un ejemplar y acerca su credencial
- **THEN** el UID se resuelve y se valida contra quien registra la devolución, igual que con el lector HID

#### Scenario: Credencial no registrada

- **WHEN** el tag leído no corresponde a ningún usuario del tenant
- **THEN** el flujo muestra "Credencial no encontrada" y permite reintentar sin cerrar el modal

### Requirement: Degradación cuando no hay NFC

Ninguna pantalla SHALL depender exclusivamente de NFC para identificar a un usuario. La Web NFC API solo existe en Chrome sobre Android; en escritorio y en iOS no está disponible.

En los mantenedores el ingreso manual y la generación de UID SHALL seguir disponibles. En los flujos de despacho el ingreso por lector HID o tecleo y la selección desde la lista de operarios SHALL seguir disponibles.

#### Scenario: Despacho desde un equipo de escritorio

- **WHEN** el bodeguero opera desde un navegador sin soporte NFC
- **THEN** puede identificar al operario con el lector HID, tecleando el UID o eligiéndolo de la lista, y completar el despacho

#### Scenario: Operario que olvidó su tarjeta

- **WHEN** no hay credencial física que leer
- **THEN** el flujo de despacho permite elegir al operario desde la lista y continuar
