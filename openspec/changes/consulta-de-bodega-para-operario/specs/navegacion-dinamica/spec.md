## MODIFIED Requirements

### Requirement: Menú filtrado por rol

`GET /api/v1/menu` SHALL devolver únicamente los `menu_items` asociados al `role_id` del token vía `role_menu_permissions`, ordenados por el campo `orden`.

El conjunto de ítems del rol `operario` SHALL ser exactamente "Mis Préstamos" (`/my-loans`) y "Bodega" (`/bodega`). Definirlo por remisión —"lo que el seed le asignó"— ya dejó pasar un error: la migración que reapuntó "Escanear" a `/catalogo/scan` le dio al operario el escáner de despacho sin que ninguna spec lo contradijera.

#### Scenario: Rol sin permiso sobre un ítem

- **WHEN** el rol del usuario no tiene registro en `role_menu_permissions` para un ítem
- **THEN** ese ítem no aparece en la respuesta

#### Scenario: Rol operario

- **WHEN** consulta el menú un usuario con rol `operario`
- **THEN** recibe exactamente "Mis Préstamos" y "Bodega", sin el escáner de despacho, la mantención de catálogo ni las secciones de administración

#### Scenario: Ítem de menú de "Mis Préstamos"

- **WHEN** el operario abre el menú lateral
- **THEN** "Mis Préstamos" aparece como ítem propio apuntando a `/my-loans`, no como un "Dashboard" que apunta a `/` y termina redirigiendo
