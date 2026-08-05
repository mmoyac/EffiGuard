## Why

Probando la captura por NFC en el demo, asignar una tarjeta Bip! a un usuario devolvió 500. El log lo dejó claro:

```
duplicate key value violates unique constraint "users_uid_credencial_key"
DETAIL:  Key (uid_credencial)=(6B:E2:61:E7) already exists.
[SQL: UPDATE users SET uid_credencial=$1 WHERE users.id = $2]
[parameters: ('6B:E2:61:E7', 16)]
```

El usuario 16 es del **tenant 1**; esa tarjeta ya pertenecía al usuario 9, del **tenant 2**. El choque fue entre empresas distintas.

Son dos problemas encadenados:

1. **La unicidad de `uid_credencial` es global.** Viene así desde la migración inicial. Pero la tarjeta Bip! es nominativa del trabajador, no de la empresa: el mismo maestro puede prestar servicios a dos empresas del sistema, y hoy la segunda no puede registrarlo. Es además la única entidad del proyecto con unicidad global — `codigos`, `productos`, `proveedores` y `ubicaciones` ya la definen por tenant.

2. **El mensaje no sirve para actuar.** El 400 sale del `catch` de `IntegrityError`, que solo sabe qué columna chocó, no quién tiene la tarjeta. El administrador lee "Esa credencial ya está asignada a otro usuario", recorre su lista de usuarios y no encuentra a nadie con ella — porque está en otro tenant, o porque el UID no se muestra completo. Un mensaje que no permite encontrar el conflicto obliga a ir a la base de datos.

El commit `9d0609f` ya evitó el 500 y devuelve un 400 legible en los cuatro caminos que escriben una credencial. Este change ataca la causa, no el síntoma.

## What Changes

- **BREAKING (esquema)**: `uid_credencial` deja de ser único global y pasa a ser único dentro del tenant — `UNIQUE (tenant_id, uid_credencial)`. Requiere migración Alembic.
- Dos tenants pueden registrar la misma tarjeta física para trabajadores distintos, que es el caso real de la Bip!.
- El conflicto se detecta **antes** de escribir, consultando el tenant, y el 400 nombra al usuario que ya tiene la credencial: *"Esa credencial ya la tiene Benjamin Moya"*. El administrador sabe a quién abrir para liberarla.
- El `catch` de `IntegrityError` se conserva como red de seguridad ante dos guardados simultáneos, pero deja de ser el camino normal.

Ningún dato existente necesita limpieza previa: como la restricción global estuvo vigente desde el inicio, es imposible que la base contenga duplicados cross-tenant.

## Capabilities

### New Capabilities

Ninguna. Todo el comportamiento afectado ya está especificado; lo que cambia es su alcance y su mensaje.

### Modified Capabilities

- `administracion-tenant`: el escenario "Credencial ya asignada" del requisito *Gestión de usuarios dentro del tenant* cambia en dos frentes — el alcance del choque pasa a ser el tenant, y el mensaje nombra al usuario en conflicto. El requisito *Gestión global de usuarios* (Super Admin) necesita cubrir que la misma credencial puede convivir en tenants distintos, y que su chequeo se hace contra el tenant del usuario editado, no contra el del Super Admin.
- `multi-tenancy`: se agrega el requisito de que toda unicidad de negocio se define dentro del tenant. Hoy la spec cubre el aislamiento en las lecturas y en la creación, pero no dice nada sobre restricciones de unicidad — y ese hueco es exactamente donde se coló `users_uid_credencial_key`.

## Impact

**Base de datos** — migración `027`: elimina `users_uid_credencial_key` y crea `uq_users_tenant_credencial`. Reversible: el `downgrade` restaura la global, y puede fallar si para entonces dos tenants comparten una tarjeta. Es la consecuencia esperada de revertir, y queda anotada en la migración.

**Backend**:

- `backend/app/models/user.py` — `unique=True` sale de la columna y entra como `UniqueConstraint` en `__table_args__`
- `backend/app/api/v1/users.py` — chequeo previo en el `POST` y el `PATCH`
- `backend/app/api/v1/superadmin.py` — ídem, contra el tenant del usuario editado
- `backend/app/core/errors.py` — se mantiene como red de seguridad

**Frontend**: sin cambios. Los mantenedores ya muestran el `detail` del 400 tal cual llega.

**Fuera de alcance, anotado**: en la base del demo, tres usuarios del tenant 1 tienen su *email* como `uid_credencial` (`alejandro@demo.cl`, `admin@demo.cl`, `gille@demo.cl`). Ninguna pantalla de credencial hace eso; el sospechoso es el alta por Google OAuth. Ocupa el índice con un valor que nadie va a escanear, pero no rompe nada y su arreglo es otro trabajo. En la misma línea: `email` y `rut` no tienen restricción `unique` ni en el modelo ni en la migración inicial, pese a que `error_usuario_duplicado` mapea mensajes para ambos y `administracion-tenant` declara un escenario "Email o RUT duplicado" que hoy no puede dispararse.
