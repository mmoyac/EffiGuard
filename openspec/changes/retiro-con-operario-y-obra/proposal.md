## Why

El retiro de consumible pide dos datos que hoy no se validan y por eso terminan mal cargados.

**Quién retira.** El selector ofrece a *todos* los usuarios del tenant: admins, bodegueros, el super admin. El material queda entregado a nombre de alguien que nunca lo recibió, y como el bodeguero opera con guantes y apuro, elegir mal el de la lista es cuestión de tiempo. Quien retira material en terreno es un operario.

**A qué obra.** El proyecto es opcional, así que el camino de menor esfuerzo es dejarlo en blanco. Un retiro sin obra no se imputa a ninguna, y el panel de gasto por proyecto —que existe para responder cuánto lleva gastado cada obra— queda contando sólo una parte. El material salió para algo; ese algo es el dato.

Además el selector de proyectos lista también los **cerrados**, así que se puede imputar consumo a una obra terminada, cuyo costo ya se dio por final.

## What Changes

- **BREAKING** — `project_id` pasa a ser obligatorio en el retiro de consumible. Las peticiones sin proyecto se rechazan.
- El retiro SHALL verificar que quien recibe tenga rol operario, además de pertenecer al tenant.
- El selector de operario lista sólo operarios; el de proyectos, sólo obras activas.
- `GET /api/v1/users` acepta filtro por rol.
- `GET /api/v1/projects` acepta filtro de sólo activos, para que los selectores no ofrezcan obras cerradas.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `inventario-consumibles`: el retiro exige proyecto y valida el rol de quien recibe.
- `administracion-tenant`: el listado de usuarios admite filtro por rol y el de proyectos admite filtro de activos.

## Impact

**Base de datos** — ninguna. `inventory_logs.project_id` sigue siendo nullable porque otros movimientos (compra, ajuste) legítimamente no tienen obra; lo que cambia es la validación del retiro.

**Backend** — `services/catalogo.py` (`retirar`), `schemas/catalogo.py` (`VarianteWithdraw`), `api/v1/users.py`, `api/v1/projects.py`.

**Frontend** — `components/catalogo/ModalEntrega.tsx`, y los mismos selectores en `ModalPrestamo.tsx` y `ModalDescuento.tsx`.

**Riesgo** — bajo, salvo un detalle: si un tenant no tiene proyectos activos, **no podrá retirar consumibles**. Es consecuencia deliberada de hacer el campo obligatorio, y la interfaz debe decirlo con esas palabras en vez de mostrar un selector vacío.
