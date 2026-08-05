## ADDED Requirements

### Requirement: Unicidad de negocio acotada al tenant

Toda restricción de unicidad sobre datos de negocio SHALL incluir `tenant_id` en su clave. Un valor único global impone a una empresa una restricción nacida de los datos de otra, que además no puede ver ni corregir.

La única excepción son las entidades globales por diseño —`roles`, `asset_states`, `modules`, `menu_items`— y los identificadores del propio tenant (`slug`, `rut_empresa`), que sí son globales porque identifican a la empresa dentro del sistema.

#### Scenario: Mismo valor de negocio en dos tenants

- **WHEN** dos tenants registran el mismo código de barras, el mismo nombre de producto o la misma credencial física
- **THEN** ambos registros conviven, porque la clave única incluye `tenant_id`

#### Scenario: Valor repetido dentro de un tenant

- **WHEN** un tenant intenta repetir un valor que su restricción declara único
- **THEN** la operación se rechaza con un mensaje que identifica el registro en conflicto dentro de esa misma empresa

#### Scenario: Alta de una restricción de unicidad

- **WHEN** se modela una entidad de negocio con un campo que debe ser único
- **THEN** la restricción se declara como `UNIQUE (tenant_id, <campo>)`, siguiendo el patrón de `uq_codigos_tenant_codigo`
