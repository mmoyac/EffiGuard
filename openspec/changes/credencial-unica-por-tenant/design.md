## Context

`users.uid_credencial` es la última columna de negocio del proyecto con unicidad global. Viene de la migración inicial (`sa.Column("uid_credencial", sa.String(100), unique=True)`), que produce la restricción `users_uid_credencial_key`, y el modelo la declara igual en [user.py:17](../../../backend/app/models/user.py).

El resto del dominio ya resolvió esto: `uq_codigos_tenant_codigo`, `uq_productos_tenant_nombre`, `uq_proveedores_tenant_nombre`, `uq_ubicaciones_tenant_posicion`. La credencial quedó fuera del patrón por antigüedad, no por decisión.

Lo que el commit `9d0609f` ya dejó hecho, y que este change no rehace: los cuatro caminos que escriben una credencial (`POST` y `PATCH` de `/users`, `POST` y `PATCH` de `/admin/users`) capturan `IntegrityError` y devuelven 400 a través de `error_usuario_duplicado()` en `core/errors.py`. Eso convirtió un 500 en un 400 legible, pero el mensaje sigue sin decir quién tiene la tarjeta.

Pieza reutilizable: `UserRepository.get_by_credential_uid(uid)` ya existe y ya es tenant-scoped — usa `_base_query()` de `BaseRepository`, que filtra por `tenant_id` en toda consulta.

## Goals / Non-Goals

**Goals:**

- Que dos empresas puedan registrar la misma tarjeta física para trabajadores distintos.
- Que el error nombre al usuario que tiene la credencial, dentro del tenant que el administrador puede ver.
- Que la regla quede escrita donde impida que la próxima entidad repita el error.

**Non-Goals:**

- Limpiar los tres usuarios del tenant 1 que tienen su email como `uid_credencial`, ni tocar el alta por Google OAuth que probablemente los produce.
- Agregar unicidad a `email` y `rut`, que hoy no la tienen pese a lo que declara la spec.
- Cambios de frontend. Los mantenedores ya renderizan el `detail` del 400 tal cual llega.
- Unificar credencial y códigos de catálogo en una sola tabla escaneable.

## Decisions

### 1. Validar antes de escribir, y dejar el `IntegrityError` como red

El chequeo previo consulta el tenant y arma el mensaje con el nombre; la restricción de base sigue siendo la autoridad.

Se descartó resolver el nombre **desde** el `IntegrityError`: el texto del error trae el valor que chocó pero no el registro dueño, así que habría que consultar igual, y encima con la sesión ya en estado fallido y necesitando `rollback` antes de poder leer. Consultar primero es más simple y produce el mismo 400.

Se descartó también quedarse solo con el chequeo previo: entre la consulta y el `commit` caben dos guardados simultáneos, y la restricción es lo único que garantiza que no pasen los dos. El `catch` deja de ser el camino normal y pasa a cubrir la carrera.

### 2. El chequeo del Super Admin se hace contra el tenant del usuario editado

`UserRepository` recibe un `tenant_id` en el constructor. En `/users` es el del token; en `/admin/users` el Super Admin no pertenece al tenant que administra, así que se construye el repositorio con `data.tenant_id` al crear y con `user.tenant_id` al editar.

Usar el tenant del token compararía contra la empresa equivocada: dejaría pasar un duplicado real y podría rechazar una credencial legítima.

### 3. Comparar por identidad, no por valor

El conflicto existe cuando el portador encontrado tiene un `id` distinto al que se está guardando. Reenviar la propia credencial al actualizar un usuario es lo que hace el formulario de edición cada vez que se guarda cualquier otro campo — si eso diera error, el mantenedor quedaría inutilizable.

### 4. Migración sin limpieza previa

`027` dropea `users_uid_credencial_key` y crea `uq_users_tenant_credencial`. No necesita paso de saneamiento: la restricción global estuvo vigente desde la migración inicial, así que la base no puede contener duplicados cross-tenant. Pasar de una restricción más estricta a una más laxa nunca encuentra datos en conflicto.

El `downgrade` restaura la global y **puede fallar** si para entonces dos tenants comparten una tarjeta. Es el comportamiento correcto —revertir a una regla más estricta con datos que la violan tiene que fallar, no borrar filas— y queda anotado en la propia migración.

### 5. El mensaje nombra, no muestra el UID

*"Esa credencial ya la tiene Benjamin Moya"* en vez de repetir el UID. El administrador busca por nombre en su lista; el UID en pantalla no le sirve para llegar al registro y, en una credencial que también puede ser un QR impreso, es ruido.

## Risks / Trade-offs

**El nombre del portador se filtra en el mensaje de error** → El portador siempre pertenece al mismo tenant que quien recibe el error, y quien lo recibe es administrador de ese tenant, con acceso a la lista completa de usuarios. No expone nada que no pueda ver. Es justamente por esto que el chequeo debe ser tenant-scoped: un chequeo global nombraría a alguien de otra empresa, y eso sí sería una fuga.

**La migración corre en producción sobre una tabla en uso** → `users` es de pocas filas y ambas operaciones son sobre índices, no reescriben datos. El backend aplica migraciones al arrancar (`docker-compose.prod.yml`), así que el despliegue la toma sin paso manual.

**Dos tenants con la misma tarjeta dejan de ser distinguibles por credencial sola** → No importa: `GET /users/scan/{uid}` ya resuelve dentro del tenant del token, que es lo que hace el escaneo en despacho. Ningún flujo busca una credencial sin saber en qué empresa está.

**El chequeo previo agrega una consulta por guardado** → Una lectura indexada por `(tenant_id, uid_credencial)` en un formulario que se guarda a mano. Irrelevante.

## Migration Plan

1. Desplegar: el backend aplica `027` al arrancar.
2. Verificar la restricción en el VPS:
   ```
   docker exec -it effiguard_db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\d users"'
   ```
   Debe aparecer `uq_users_tenant_credencial` y no `users_uid_credencial_key`.
3. Reintentar el caso que falló: asignar `6B:E2:61:E7` al usuario 16 del tenant 1, con esa tarjeta aún en el usuario 9 del tenant 2. Debe guardar.

Rollback: `alembic downgrade -1` restaura la global, y falla si en el intertanto dos tenants compartieron una tarjeta. En ese caso hay que liberar una de las dos antes de revertir.

## Open Questions

Ninguna bloqueante. Queda pendiente de decidir, fuera de este change, si `email` y `rut` deben ser únicos por tenant — la spec de `administracion-tenant` afirma que lo son y la base no los restringe, así que hoy hay una spec que describe algo que no ocurre.
