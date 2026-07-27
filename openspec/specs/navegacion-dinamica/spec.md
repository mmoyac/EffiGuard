# Navegación Dinámica (Server-Driven UI) Specification

## Purpose

Construir el menú lateral de la aplicación desde el servidor según el rol del usuario, de modo que cambiar la navegación de un rol no requiera desplegar el frontend.

## Requirements

### Requirement: Menú construido desde el servidor

El sidebar del frontend SHALL construirse consumiendo `GET /api/v1/menu`, sin rutas hardcodeadas en el código de React.

#### Scenario: Usuario autenticado abre la aplicación

- **WHEN** el frontend renderiza el layout
- **THEN** solicita `/menu` y dibuja los ítems recibidos con su label, ruta, ícono y orden

### Requirement: Menú filtrado por rol

`GET /api/v1/menu` SHALL devolver únicamente los `menu_items` asociados al `role_id` del token vía `role_menu_permissions`, ordenados por el campo `orden`.

#### Scenario: Rol sin permiso sobre un ítem

- **WHEN** el rol del usuario no tiene registro en `role_menu_permissions` para un ítem
- **THEN** ese ítem no aparece en la respuesta

#### Scenario: Rol operario

- **WHEN** consulta el menú un usuario con rol `operario`
- **THEN** recibe sólo los ítems que el seed le asignó, sin acceso a las secciones de administración

### Requirement: Jerarquía de menú anidada

Los ítems SHALL soportar jerarquía padre-hijo mediante `parent_id`. La respuesta devuelve sólo raíces (`parent_id IS NULL`) con sus hijos anidados hasta dos niveles.

#### Scenario: Grupo de menú con subítems

- **WHEN** un ítem raíz tiene hijos permitidos para el rol
- **THEN** llegan anidados en `children` dentro del ítem padre, no como entradas planas

### Requirement: Modelo de módulos, ítems y permisos

La navegación SHALL modelarse con tres tablas globales: `modules` (agrupador con ícono y orden), `menu_items` (label, ruta, ícono, orden, `module_id`, `parent_id`) y `role_menu_permissions` (relación rol ↔ ítem).

#### Scenario: Alta de una sección nueva

- **WHEN** el Super Admin crea un módulo, sus ítems de menú y asigna permisos a un rol
- **THEN** los usuarios de ese rol ven la nueva sección en su próximo login sin cambios de código
