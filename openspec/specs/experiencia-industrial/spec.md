# Experiencia Industrial y PWA Specification

## Purpose

Entregar una interfaz usable con guantes, a una mano y en condiciones de fábrica: instalable como app, en modo oscuro, mobile-first y sin scroll horizontal, con identidad visual del tenant.

## Requirements

### Requirement: Aplicación instalable como PWA

El frontend SHALL registrarse como PWA con service worker de auto-actualización, manifiesto base, íconos 192/512 maskable, modo `standalone` y orientación vertical.

#### Scenario: Usuario no autenticado

- **WHEN** aún no hay sesión
- **THEN** se usa el manifiesto estático genérico "EffiGuard"

### Requirement: Manifiesto e identidad por tenant

Tras el login, el manifiesto SHALL reemplazarse dinámicamente por `GET /api/v1/pwa/manifest/{tenant_id}`, y el título de la página y el meta `apple-mobile-web-app-title` SHALL reflejar el nombre de la empresa.

#### Scenario: Instalación en Android

- **WHEN** un usuario del tenant "Propublix" instala la app
- **THEN** el nombre mostrado es "EffiGuard · Propublix" y el short name se trunca a 12 caracteres para caber bajo el ícono

#### Scenario: Instalación en iOS

- **WHEN** se agrega a la pantalla de inicio en Safari
- **THEN** el label del ícono usa el nombre del tenant truncado a 14 caracteres

#### Scenario: Tenant inexistente o inactivo

- **WHEN** se pide el manifiesto de un tenant que no existe o está desactivado
- **THEN** se devuelve el manifiesto genérico "EffiGuard", sin error

#### Scenario: Manifiesto sin caché

- **WHEN** se sirve el manifiesto dinámico
- **THEN** se envía con `Cache-Control: no-cache, no-store, must-revalidate` para que el cambio de tenant se refleje de inmediato

### Requirement: Interfaz táctil industrial

La interfaz SHALL estar diseñada para uso con guantes: modo oscuro forzado, botones de al menos 48px de alto y acción principal del escáner de al menos 64px.

#### Scenario: Botón de acción principal tras un escaneo

- **WHEN** se muestra la acción resuelta de un activo escaneado
- **THEN** ocupa el ancho completo con altura mínima de 64px y color distintivo por tipo de acción

### Requirement: Mobile-first sin scroll horizontal

Toda vista SHALL caber en el ancho del dispositivo desde 320px, escalando hacia arriba con breakpoints. Las tablas se reemplazan por tarjetas en móvil.

#### Scenario: Vista de listado en un teléfono industrial

- **WHEN** se abre un listado en una pantalla angosta
- **THEN** el contenido se adapta sin desbordar horizontalmente

### Requirement: Impresión de etiquetas QR

El sistema SHALL generar etiquetas imprimibles con el código QR del `uid_fisico` del activo, su nombre y subtítulo, abriendo una ventana lista para imprimir.

#### Scenario: Etiqueta de un activo

- **WHEN** se solicita imprimir la etiqueta de un activo
- **THEN** se genera un QR con corrección de errores nivel M que codifica el `uid_fisico`, junto al nombre legible y el UID en texto

### Requirement: Aislamiento de sesión en el cliente

Al cerrar sesión el frontend SHALL limpiar los tokens, el logo del tenant y todo el caché de React Query, para que el siguiente usuario no vea datos del anterior.

#### Scenario: Cambio de usuario en un terminal compartido de bodega

- **WHEN** un usuario cierra sesión y otro entra en el mismo dispositivo
- **THEN** ninguna vista muestra datos residuales del usuario previo

#### Scenario: Cambio de tenant por el Super Admin

- **WHEN** el Super Admin selecciona otro tenant en la barra superior
- **THEN** se invalidan todas las queries para recargar los datos del nuevo contexto
