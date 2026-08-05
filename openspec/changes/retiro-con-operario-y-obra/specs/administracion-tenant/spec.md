## ADDED Requirements

### Requirement: Listado de usuarios filtrable por rol

`GET /api/v1/users` SHALL aceptar un filtro opcional por rol, para que los selectores ofrezcan sólo a quienes corresponde.

Sin él, cada formulario tendría que traer la lista completa y filtrarla en el cliente, repitiendo en cada pantalla una regla que cambia con los roles.

#### Scenario: Selector de operarios

- **WHEN** se listan usuarios con el filtro de rol operario
- **THEN** devuelve sólo los operarios activos del tenant

#### Scenario: Sin filtro

- **WHEN** no se envía el filtro
- **THEN** devuelve todos los usuarios del tenant, como hasta ahora

### Requirement: Listado de proyectos filtrable por estado

`GET /api/v1/projects` SHALL aceptar un filtro opcional para devolver sólo obras activas.

Los selectores operativos —despachar material, prestar una herramienta— no deben ofrecer obras cerradas: imputarles consumo contradice que su costo ya se dio por final. La pantalla de mantención sí necesita verlas todas, para poder reactivarlas.

#### Scenario: Selector operativo

- **WHEN** se listan proyectos con el filtro de activos
- **THEN** devuelve sólo los que tienen `is_active = true`

#### Scenario: Mantención de proyectos

- **WHEN** no se envía el filtro
- **THEN** devuelve activos e inactivos, para poder reactivar una obra cerrada por error
