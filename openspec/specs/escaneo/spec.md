# Escaneo y Resolución Contextual Specification

## Purpose

Convertir un único gesto —escanear un código— en la acción operativa correcta, soportando lectores HID, cámara, NFC e ingreso manual, para que el bodeguero opere sin navegar por menús.

## Requirements

### Requirement: Resolución de activo por UID escaneado

`GET /api/v1/assets/scan/{uid_fisico}` SHALL resolver el activo del tenant por su UID físico. Si el activo es raíz, la respuesta incluye sus hijos.

#### Scenario: UID no registrado

- **WHEN** se escanea un código que no corresponde a ningún activo del tenant
- **THEN** responde 404 con "Activo no encontrado" y la interfaz muestra el error durante 4 segundos

#### Scenario: Escaneo de un hijo de kit

- **WHEN** el activo escaneado tiene `parent_asset_id` no nulo
- **THEN** se devuelve el activo individual, sin expandir el kit

### Requirement: Acción principal derivada del contexto del activo

Tras un escaneo, la interfaz SHALL resolver una única acción principal según el estado y comportamiento del activo, con esta precedencia:

1. Estado En Reparación → "Marcar como reparada"
2. Estado distinto de Disponible o En Terreno → "No disponible para operar"
3. Familia consumible → "Retirar Consumible"
4. Existe préstamo activo → "Registrar Devolución"
5. Es kit padre → "Prestar Kit Completo"
6. Resto → "Registrar Préstamo"

#### Scenario: Herramienta disponible sin hijos

- **WHEN** se escanea una herramienta en estado Disponible sin préstamo activo ni hijos
- **THEN** la acción ofrecida es "Registrar Préstamo"

#### Scenario: Herramienta en terreno

- **WHEN** se escanea una herramienta con préstamo abierto
- **THEN** la acción ofrecida es "Registrar Devolución" y se muestra quién la tiene, desde cuándo, quién la entregó y a qué proyecto

#### Scenario: Herramienta robada

- **WHEN** se escanea un activo en estado Robado
- **THEN** se muestra "No disponible para operar" y no se ofrece acción principal

#### Scenario: Consumible

- **WHEN** se escanea un activo de familia consumible
- **THEN** se muestra el stock actual, resaltado en amarillo si `stock_actual <= stock_minimo`, y la acción es "Retirar Consumible"

### Requirement: Acciones secundarias del escaneo

Además de la acción principal, la interfaz SHALL ofrecer "Reportar pérdida" para cualquier activo que no esté ya en estado Robado, y "Registrar merma" sólo para consumibles.

#### Scenario: Activo ya robado

- **WHEN** el activo escaneado está en estado Robado
- **THEN** no se ofrece el botón de reportar pérdida

### Requirement: Captura por lector HID

El sistema SHALL capturar la entrada de lectores RFID/QR que emulan teclado, distinguiéndola del tipeo manual por la velocidad entre pulsaciones.

#### Scenario: Ráfaga de lector con Enter final

- **WHEN** el lector emite los caracteres del código seguidos de Enter
- **THEN** el buffer se procesa como escaneo si tiene al menos 4 caracteres

#### Scenario: Lector que no envía Enter

- **WHEN** transcurre el timeout sin recibir Enter
- **THEN** el buffer acumulado se procesa igualmente como escaneo

#### Scenario: Foco en un campo de texto

- **WHEN** el usuario está escribiendo en un `input`, `textarea` o `select`
- **THEN** el capturador global ignora esas pulsaciones y no dispara escaneos falsos

### Requirement: Escaneo por cámara

La página de escáner SHALL ofrecer lectura de códigos QR con la cámara del dispositivo como alternativa al lector físico.

#### Scenario: Código leído por cámara

- **WHEN** la cámara decodifica un código
- **THEN** la cámara se cierra y el UID se procesa como escaneo

### Requirement: Escaneo por NFC

La página de escáner SHALL ofrecer lectura de tags NFC vía Web NFC API, degradando con un mensaje cuando el navegador no la soporta.

#### Scenario: Navegador sin soporte Web NFC

- **WHEN** `NDEFReader` no existe en `window`
- **THEN** el componente informa que el dispositivo o navegador no soporta NFC

### Requirement: Ingreso manual de UID

La página de escáner SHALL incluir un campo de texto para ingresar el UID a mano, como fallback cuando no hay lector disponible.

#### Scenario: Búsqueda manual

- **WHEN** el usuario escribe un UID y envía el formulario
- **THEN** se ejecuta el mismo flujo de escaneo que con un lector físico

### Requirement: Escaneo de credencial de operario

`GET /api/v1/users/scan/{uid_credencial}` SHALL resolver un usuario del tenant por el UID de su tag RFID/NFC o QR de empleado, para confirmar quién recibe un préstamo o retiro.

#### Scenario: Credencial no registrada

- **WHEN** se escanea una credencial sin usuario asociado en el tenant
- **THEN** responde 404 con "Credencial no encontrada"

### Requirement: Serialización de escaneos

Mientras un escaneo está resolviéndose, el sistema SHALL ignorar nuevos escaneos, y al iniciar uno nuevo SHALL limpiar el resultado anterior (activo, hijos de kit, préstamo activo y modal abierto).

#### Scenario: Doble lectura del lector

- **WHEN** el lector dispara dos veces seguidas mientras la primera petición sigue en curso
- **THEN** la segunda lectura se descarta
