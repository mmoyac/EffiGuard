## MODIFIED Requirements

### Requirement: Gestión global de usuarios

El Super Admin SHALL poder listar usuarios de todos los tenants (con filtro opcional por `tenant_id`), crearlos indicando su tenant y rol, y actualizar nombre, email, rol, estado, credencial y contraseña.

Al asignar una credencial, el conflicto SHALL evaluarse contra el tenant del usuario creado o editado, no contra el del Super Admin. El Super Admin no pertenece al tenant que administra en ese momento, así que usar el suyo compararía contra la empresa equivocada.

#### Scenario: Cambio de contraseña por Super Admin

- **WHEN** se envía `password` en la actualización
- **THEN** se almacena su hash bcrypt y el resto de campos se actualiza normalmente

#### Scenario: Misma credencial en dos tenants distintos

- **WHEN** el Super Admin asigna a un usuario del tenant B una credencial que ya usa un usuario del tenant A
- **THEN** la asignación se acepta: la tarjeta es del trabajador y puede servir en las dos empresas

#### Scenario: Credencial ya usada dentro del tenant del usuario editado

- **WHEN** el Super Admin asigna una credencial que ya tiene otro usuario del mismo tenant
- **THEN** responde 400 nombrando a ese usuario, sin consultar el tenant del propio Super Admin

### Requirement: Gestión de usuarios dentro del tenant

El administrador del tenant SHALL poder listar, crear, consultar y actualizar usuarios de su propia empresa, con RUT, nombre, email, contraseña, rol y credencial física opcional.

La credencial SHALL ser única dentro del tenant, no entre tenants. Cuando ya la tiene otro usuario de la empresa, el error SHALL nombrarlo, para que el administrador sepa a quién abrir para liberarla en vez de tener que buscar el UID a mano.

#### Scenario: Credencial ya asignada dentro del tenant

- **WHEN** se crea o actualiza un usuario con un `uid_credencial` que ya usa otro usuario del mismo tenant
- **THEN** responde 400 con "Esa credencial ya la tiene {nombre del usuario}"

#### Scenario: Credencial en uso en otro tenant

- **WHEN** se asigna un `uid_credencial` que sólo usa un usuario de otra empresa
- **THEN** la asignación se acepta, porque la unicidad se evalúa dentro del tenant

#### Scenario: Usuario guardado sin tocar su credencial

- **WHEN** se actualiza un usuario reenviando el `uid_credencial` que ya tenía
- **THEN** el guardado procede: el único portador de esa credencial es él mismo

#### Scenario: Email o RUT duplicado

- **WHEN** el email o el RUT ya existen
- **THEN** responde 400 con el mensaje específico del campo en conflicto

#### Scenario: Actualización de contraseña

- **WHEN** se envía `password` en el PATCH
- **THEN** se guarda su hash y nunca el valor en claro
