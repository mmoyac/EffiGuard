## MODIFIED Requirements

### Requirement: Aplicación instalable como PWA

El frontend SHALL registrarse como PWA con service worker, íconos 192/512 con `purpose` `any` y `maskable` en entradas separadas, modo `standalone` y orientación vertical. El service worker nuevo SHALL quedar en espera hasta que el usuario acepte actualizar, para no tomar control de una pestaña que sigue ejecutando el bundle anterior.

#### Scenario: Dominio base sin tenant

- **WHEN** se carga la aplicación en un host que no corresponde a ningún subdominio de tenant
- **THEN** el manifiesto responde con la identidad genérica "EffiGuard" y los íconos de `/icons/`

#### Scenario: Hay una versión nueva desplegada

- **WHEN** el service worker detecta un `sw.js` distinto al instalado
- **THEN** queda en estado *waiting* y la interfaz ofrece recargar, sin recargar por su cuenta

#### Scenario: El usuario acepta actualizar

- **WHEN** el usuario confirma el aviso de versión nueva
- **THEN** el service worker en espera toma control y la página se recarga con el bundle nuevo

#### Scenario: Aplicación instalada abierta por tiempo prolongado

- **WHEN** la PWA lleva horas abierta sin recargarse
- **THEN** el cliente consulta periódicamente si hay una versión nueva, y también al volver a primer plano y al recuperar conexión

### Requirement: Manifiesto e identidad por tenant

El manifiesto SHALL servirse desde `GET /api/v1/pwa/manifest`, resolviendo el tenant a partir del `Host` de la petición y sin requerir autenticación, de modo que la identidad correcta esté disponible en la primera carga y antes de cualquier login.

La identidad SHALL repartirse así: la **imagen** identifica a la empresa y el **texto** identifica al producto. El `short_name` SHALL ser `"EffiGuard"` fijo; el `name` SHALL ser `"EffiGuard · {nombre_empresa}"`.

Los íconos SHALL derivarse de `tenants.logo_url`.

#### Scenario: Instalación en Android desde el subdominio de un tenant

- **WHEN** un usuario abre `effiguard-propublix.effi4tech.cl` e instala la app sin haber iniciado sesión
- **THEN** el ícono es el logo de Propublix, la glosa bajo el ícono dice "EffiGuard" y el diálogo de instalación dice "EffiGuard · Propublix"

#### Scenario: Instalación en iOS

- **WHEN** se agrega a la pantalla de inicio en Safari
- **THEN** el ícono proviene de `GET /api/v1/pwa/apple-touch-icon`, que resuelve el tenant por `Host` y redirige al derivado `any` de 192px, y el label dice "EffiGuard"

#### Scenario: Tenant sin logo cargado

- **WHEN** el tenant existe y está activo pero su `logo_url` es nulo
- **THEN** el manifiesto devuelve los íconos genéricos de `/icons/`, conservando el `name` con el nombre de la empresa

#### Scenario: Tenant inexistente o inactivo

- **WHEN** el `Host` no corresponde a ningún tenant, o el tenant está desactivado
- **THEN** se devuelve el manifiesto genérico "EffiGuard" con los íconos genéricos, sin error

#### Scenario: Manifiesto sin caché

- **WHEN** se sirve el manifiesto
- **THEN** se envía con `Cache-Control: no-cache, no-store, must-revalidate` para que un cambio de logo o de nombre se refleje en la próxima lectura

## ADDED Requirements

### Requirement: Derivación de íconos PWA desde el logo del tenant

El sistema SHALL generar, a partir de `tenants.logo_url`, cuatro PNG por tenant: 192 y 512 px, cada uno en variante `any` y `maskable`. La composición SHALL usar `contain` sobre fondo `#111827`, sin deformar el logo. La variante `maskable` SHALL contener el logo dentro del 80% central del lienzo, que es la zona segura de la especificación de maskable icons.

Los derivados SHALL nombrarse incluyendo un hash del contenido del logo de origen, de forma que un logo distinto produzca URLs distintas y los derivados anteriores puedan cachearse indefinidamente sin invalidación activa.

#### Scenario: Logo rectangular

- **WHEN** el logo de origen mide 800x200
- **THEN** el derivado es cuadrado, el logo conserva su proporción y el espacio sobrante se rellena con `#111827`

#### Scenario: Recorte adaptativo de Android

- **WHEN** Android aplica su máscara circular sobre el ícono `maskable`
- **THEN** el logo completo permanece visible, por estar contenido en el 80% central

#### Scenario: Logo en formato SVG

- **WHEN** el logo de origen es un SVG y no puede rasterizarse
- **THEN** no se generan derivados y el tenant conserva los íconos genéricos, sin error en la carga del logo

#### Scenario: Derivados aún no generados

- **WHEN** un tenant tiene `logo_url` pero sus archivos derivados no existen en disco
- **THEN** el manifiesto responde con los íconos genéricos en lugar de apuntar a un archivo inexistente
