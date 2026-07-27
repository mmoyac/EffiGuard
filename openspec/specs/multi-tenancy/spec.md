# Multi-tenancy Specification

## Purpose

Aislar los datos de cada empresa cliente (tenant) dentro de una única instancia de EffiGuard, resolviendo el tenant desde el subdominio y garantizando que ninguna consulta cruce el límite de tenant.

## Requirements

### Requirement: Aislamiento automático por tenant en la capa de persistencia

Todo acceso a datos de negocio SHALL filtrarse por `tenant_id` en la capa de repositorio, sin depender de que cada endpoint recuerde aplicar el filtro. `BaseRepository` recibe el `tenant_id` en su constructor y lo inyecta en toda query de lectura, en el conteo y en la creación de registros.

#### Scenario: Lectura de un registro de otro tenant

- **WHEN** un usuario del tenant A solicita por ID un activo que pertenece al tenant B
- **THEN** el repositorio no lo encuentra y el endpoint responde 404, sin revelar la existencia del registro

#### Scenario: Creación de un registro

- **WHEN** se crea cualquier entidad a través de `BaseRepository.create()`
- **THEN** el `tenant_id` del token autenticado se asigna automáticamente al registro, sin que el cliente pueda enviarlo

#### Scenario: Entidades con `tenant_id`

- **WHEN** se modela una entidad de negocio (activos, familias, préstamos, logs, usuarios, proyectos, marcas, modelos, API keys, suscripciones)
- **THEN** la tabla incluye una columna `tenant_id` indexada con FK a `tenants.id`

### Requirement: Entidades globales sin tenant

Los catálogos compartidos por todos los tenants SHALL vivir fuera del filtro multi-tenant: `roles`, `asset_states`, `modules`, `menu_items` y `role_menu_permissions` son globales.

#### Scenario: Consulta de estados de activo

- **WHEN** cualquier tenant consulta `GET /api/v1/catalog/states`
- **THEN** recibe la lista completa de estados globales (Disponible, En Terreno, En Reparación, Robado) sin filtro por tenant

### Requirement: Resolución de tenant por subdominio

En producción el tenant SHALL resolverse desde el host de la petición, con el patrón `effiguard-{slug}.{BASE_DOMAIN}` (por defecto `effi4tech.cl`). Cuando el host no matchea el patrón (desarrollo local), la resolución de usuario se hace global por email.

#### Scenario: Login desde el subdominio de un tenant activo

- **WHEN** llega un login a `effiguard-propublix.effi4tech.cl`
- **THEN** el sistema extrae el slug `propublix`, resuelve el tenant activo con ese slug y busca al usuario dentro de ese tenant

#### Scenario: Slug inexistente o tenant desactivado

- **WHEN** el slug del subdominio no corresponde a ningún tenant con `is_active = true`
- **THEN** el sistema responde 404 con "Tenant no encontrado"

#### Scenario: Host local sin subdominio de tenant

- **WHEN** la petición llega desde `localhost` u otro host que no matchea el patrón
- **THEN** el usuario se busca globalmente por email, sin filtro de tenant

### Requirement: Suplantación de tenant por Super Admin

El rol Super Admin (`role_id == 1`) SHALL poder operar sobre cualquier tenant enviando la cabecera `X-Acting-Tenant` con el ID del tenant destino. El `tenant_id` efectivo de la petición pasa a ser el de la cabecera.

#### Scenario: Super Admin con tenant seleccionado

- **WHEN** un usuario con `role_id == 1` envía `X-Acting-Tenant: 3`
- **THEN** todos los repositorios de esa petición usan `tenant_id = 3`

#### Scenario: Usuario no Super Admin envía la cabecera

- **WHEN** un usuario con `role_id != 1` envía `X-Acting-Tenant`
- **THEN** la cabecera se ignora y se mantiene el `tenant_id` del token

#### Scenario: Cabecera con valor no numérico

- **WHEN** `X-Acting-Tenant` no es un entero
- **THEN** el sistema responde 400 con "X-Acting-Tenant debe ser un entero"

#### Scenario: Frontend del Super Admin sin tenant seleccionado

- **WHEN** un Super Admin abre una vista de datos de tenant sin haber elegido tenant en la barra superior
- **THEN** `TenantGuard` bloquea el contenido y muestra "Selecciona un tenant en la barra superior para ver los datos"

### Requirement: CORS restringido a subdominios del dominio base

En producción el backend SHALL aceptar únicamente orígenes que matcheen `https://effiguard-{slug}.{BASE_DOMAIN}`. En desarrollo acepta cualquier origen.

#### Scenario: Petición desde un dominio ajeno en producción

- **WHEN** un origen externo al patrón intenta consumir la API en producción
- **THEN** el middleware CORS no autoriza el origen
