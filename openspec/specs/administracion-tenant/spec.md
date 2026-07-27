# Administración de Tenant y Super Admin Specification

## Purpose

Permitir al Super Admin dar de alta empresas clientes y su configuración global, y al administrador de cada tenant gestionar sus usuarios y proyectos.

## Requirements

### Requirement: Router exclusivo de Super Admin

Todos los endpoints bajo `/api/v1/admin` SHALL exigir `role_id == 1`.

#### Scenario: Acceso con rol insuficiente

- **WHEN** un usuario con rol distinto de `super_admin` llama cualquier endpoint bajo `/admin`
- **THEN** responde 403 con "Se requiere rol Super Admin"

### Requirement: Alta y mantención de tenants

El Super Admin SHALL poder listar, crear y actualizar tenants. La creación exige nombre de empresa, RUT único, slug único y tipo de plan (`basic` por defecto), y siembra las familias de activos iniciales.

#### Scenario: Creación de tenant

- **WHEN** se crea un tenant nuevo
- **THEN** queda activo y con las familias "Herramienta" (prestable) y "Consumible" (consumible) ya creadas

#### Scenario: Desactivación de un tenant

- **WHEN** se marca `is_active = false`
- **THEN** el login desde su subdominio deja de resolver el tenant

### Requirement: Logo por tenant

El Super Admin SHALL poder subir un logo por tenant en formato PNG, JPEG, WebP o SVG. El archivo se guarda bajo `/static/logos/` con nombre único y reemplaza al anterior, que se elimina del disco.

#### Scenario: Formato no permitido

- **WHEN** se sube un archivo con content-type fuera del set permitido
- **THEN** responde 400 con "Tipo de archivo no permitido. Use PNG, JPEG, WebP o SVG."

#### Scenario: Reemplazo de logo existente

- **WHEN** el tenant ya tenía logo
- **THEN** el archivo anterior se borra del disco y `logo_url` apunta al nuevo

### Requirement: Gestión global de usuarios

El Super Admin SHALL poder listar usuarios de todos los tenants (con filtro opcional por `tenant_id`), crearlos indicando su tenant y rol, y actualizar nombre, email, rol, estado, credencial y contraseña.

#### Scenario: Cambio de contraseña por Super Admin

- **WHEN** se envía `password` en la actualización
- **THEN** se almacena su hash bcrypt y el resto de campos se actualiza normalmente

### Requirement: Configuración global de catálogos y navegación

El Super Admin SHALL poder administrar los estados de activo, los módulos, los ítems de menú y los permisos de menú por rol.

#### Scenario: Reemplazo de permisos de un rol

- **WHEN** se envía `PUT /api/v1/admin/permissions` con un `role_id` y una lista de `menu_item_ids`
- **THEN** se eliminan todos los permisos previos del rol y se insertan exactamente los enviados

#### Scenario: Consulta de permisos de un rol

- **WHEN** se lista con `?role_id=N`
- **THEN** devuelve sólo los permisos de ese rol

### Requirement: Resumen de tenant

`GET /api/v1/admin/tenants/{tenant_id}/summary` SHALL devolver el conteo de usuarios, activos y préstamos activos del tenant.

#### Scenario: Vista de administración de tenants

- **WHEN** el Super Admin abre la ficha de un tenant
- **THEN** ve sus totales sin necesidad de cambiar de contexto

### Requirement: Gestión de usuarios dentro del tenant

El administrador del tenant SHALL poder listar, crear, consultar y actualizar usuarios de su propia empresa, con RUT, nombre, email, contraseña, rol y credencial física opcional.

#### Scenario: Credencial ya asignada

- **WHEN** se crea un usuario con un `uid_credencial` que ya usa otro usuario
- **THEN** responde 400 con "Esa credencial ya está asignada a otro usuario"

#### Scenario: Email o RUT duplicado

- **WHEN** el email o el RUT ya existen
- **THEN** responde 400 con el mensaje específico del campo en conflicto

#### Scenario: Actualización de contraseña

- **WHEN** se envía `password` en el PATCH
- **THEN** se guarda su hash y nunca el valor en claro

### Requirement: Gestión de proyectos

El tenant SHALL poder crear proyectos, listarlos y activarlos o desactivarlos, para imputar préstamos y retiros de consumibles.

#### Scenario: Desactivación de proyecto

- **WHEN** se llama `PATCH /api/v1/projects/{id}/deactivate`
- **THEN** el proyecto queda con `is_active = false` sin eliminarse, preservando el histórico
