# Integraciones y API Externa Specification

## Purpose

Exponer datos de bodega a agentes y automatizaciones externas (n8n) mediante autenticación por API key, y ofrecer un asistente conversacional dentro de la aplicación.

## Requirements

### Requirement: Autenticación por API key

El sistema SHALL aceptar autenticación mediante la cabecera `X-API-Key` para los endpoints destinados a integraciones. La key resuelve el tenant sobre el que opera la petición.

#### Scenario: Petición sin cabecera

- **WHEN** se llama un endpoint de integración sin `X-API-Key`
- **THEN** responde 401 con "X-API-Key requerido"

#### Scenario: Key inválida o revocada

- **WHEN** la key no existe o tiene `is_active = false`
- **THEN** responde 401 con "API key inválida o revocada"

### Requirement: Ciclo de vida de las API keys

Un administrador del tenant (`role_id <= 2`) SHALL poder crear, listar y revocar API keys. La key se genera con prefijo `efg_` y 56 caracteres hexadecimales, y su valor sólo se muestra en la respuesta de creación.

#### Scenario: Listado posterior a la creación

- **WHEN** se listan las API keys del tenant
- **THEN** se devuelve sólo metadata (id, descripción, estado, fecha) sin el valor de la key

#### Scenario: Revocación

- **WHEN** se elimina una key
- **THEN** queda con `is_active = false` en lugar de borrarse, preservando la traza

#### Scenario: Usuario sin rol administrativo

- **WHEN** un usuario con `role_id > 2` intenta operar sobre API keys
- **THEN** responde 403 con "Solo administradores"

### Requirement: Consulta de disponibilidad para agentes

`GET /api/v1/assets/query?q=<texto>` SHALL buscar activos raíz del tenant cuyo nombre contenga el texto, con respuesta adaptada al comportamiento de cada uno.

#### Scenario: Consulta de una herramienta

- **WHEN** el activo encontrado es prestable
- **THEN** la respuesta incluye su estado, el operario que lo tiene (si hay préstamo abierto) y la fecha de préstamo formateada como `dd/mm/aaaa hh:mm`

#### Scenario: Consulta de un consumible

- **WHEN** el activo encontrado es consumible
- **THEN** la respuesta incluye `stock_actual`, `stock_minimo` y el indicador `bajo_stock`

#### Scenario: Hijos de kit excluidos

- **WHEN** la búsqueda coincide con activos hijos de un kit
- **THEN** se excluyen del resultado, devolviendo sólo activos raíz

### Requirement: Asistente conversacional de bodega

La aplicación SHALL incluir un widget de chat que envía los mensajes a un webhook de n8n y muestra la respuesta del agente, manteniendo un `sessionId` por pestaña para conservar el hilo de conversación.

#### Scenario: Error del webhook

- **WHEN** n8n responde con un código distinto de 2xx o falla la red
- **THEN** el widget muestra un mensaje de error en el hilo y registra el detalle en la consola, sin romper la aplicación

#### Scenario: Entorno de desarrollo

- **WHEN** la aplicación corre en modo dev
- **THEN** el chat apunta al proxy local `/n8n-webhook/...` en vez del host de producción
