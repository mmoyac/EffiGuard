## MODIFIED Requirements

### Requirement: Retiro de consumible sin préstamo

`POST /api/v1/variantes/{variante_id}/withdraw` SHALL descontar la cantidad solicitada de `stock_actual` de la variante y registrar un `InventoryLog` tipo `entrega`, sin crear ningún registro en `loans`.

El **operario** que retira SHALL pertenecer al tenant y tener rol operario. Quien retira material en terreno es un operario; ofrecer al resto de los usuarios sólo agrega formas de equivocarse en un mesón donde se opera con guantes y apuro.

El **proyecto** SHALL ser obligatorio. Un retiro sin obra no se imputa a ninguna, y el panel de gasto por proyecto termina contando sólo una parte del material que salió. El material se despachó para algo; ese algo es el dato que hace útil el registro.

#### Scenario: Variante prestable enviada al endpoint de consumibles

- **WHEN** la familia del producto de la variante no es `consumible`
- **THEN** responde 400 con "El item no es un consumible"

#### Scenario: Stock insuficiente

- **WHEN** la cantidad solicitada supera el `stock_actual` de la variante
- **THEN** responde 400 con "Stock insuficiente" y el stock no se modifica

#### Scenario: Operario inexistente o de otro tenant

- **WHEN** el `operario_id` no existe o pertenece a otro tenant
- **THEN** responde 404 con "Operario no encontrado"

#### Scenario: Usuario que no es operario

- **WHEN** el `operario_id` corresponde a un admin, bodeguero o super admin del tenant
- **THEN** responde 400 explicando que el material se entrega a un operario

#### Scenario: Retiro sin proyecto

- **WHEN** la petición no incluye `project_id`
- **THEN** se rechaza: sin obra el consumo no se imputa a ninguna parte

#### Scenario: Proyecto inexistente, de otro tenant o cerrado

- **WHEN** el `project_id` no existe, pertenece a otro tenant o está inactivo
- **THEN** responde 404 o 400 según el caso, porque una obra cerrada ya dio su costo por final

#### Scenario: Retiro válido

- **WHEN** hay stock suficiente, el operario es del tenant y tiene rol operario, y el proyecto está activo
- **THEN** el stock de la variante baja en la cantidad indicada y se crea el log con el operario y la obra

#### Scenario: Tenant sin obras activas

- **WHEN** el tenant no tiene ningún proyecto activo
- **THEN** la interfaz explica que hay que crear o reactivar una obra antes de despachar, en vez de mostrar un selector vacío

#### Scenario: Retiro sobre una variante con varios proveedores

- **WHEN** se retiran 50 unidades de una variante que tiene códigos de tres proveedores
- **THEN** se descuentan de su único stock, sin preguntar de qué proveedor provienen
