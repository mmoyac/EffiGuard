## 1. Esquema

- [x] 1.1 En `backend/app/models/user.py`, quitar `unique=True` de la columna `uid_credencial` y agregar `__table_args__ = (UniqueConstraint("tenant_id", "uid_credencial", name="uq_users_tenant_credencial"),)`
- [x] 1.2 Crear `backend/alembic/versions/027_credencial_unica_por_tenant.py` con `down_revision` apuntando a `026`
- [x] 1.3 En el `upgrade`: `drop_constraint("users_uid_credencial_key", "users", type_="unique")` y `create_unique_constraint("uq_users_tenant_credencial", "users", ["tenant_id", "uid_credencial"])`
- [x] 1.4 En el `downgrade`: la operación inversa, con un comentario de que puede fallar si dos tenants comparten una tarjeta y que eso es lo correcto

## 2. Detección del conflicto antes de escribir

- [x] 2.1 Agregar a `UserRepository` un método que devuelva el portador de una credencial dentro del tenant excluyendo un `id` dado, sobre `get_by_credential_uid()`, que ya filtra por tenant
- [x] 2.2 Añadir a `core/errors.py` la construcción del 400 que nombra al portador: "Esa credencial ya la tiene {nombre}"
- [x] 2.3 Aplicar el chequeo en `POST /api/v1/users` antes de crear
- [x] 2.4 Aplicar el chequeo en `PATCH /api/v1/users/{id}`, excluyendo al propio usuario para que reenviar su credencial no dé error
- [x] 2.5 Conservar el `catch` de `IntegrityError` en los cuatro caminos como red ante guardados simultáneos

## 3. Router de Super Admin

- [x] 3.1 En `POST /api/v1/admin/users`, chequear contra `data.tenant_id` — el tenant del usuario creado, no el del Super Admin
- [x] 3.2 En `PATCH /api/v1/admin/users/{id}`, chequear contra `user.tenant_id`, excluyendo al propio usuario
- [ ] 3.3 Verificar que asignar en el tenant B una credencial que existe en el tenant A ya no da error

## 4. Verificación

- [ ] 4.1 `alembic upgrade head` y `alembic downgrade -1` sobre una base local, comprobando que ambos corren
- [ ] 4.2 Confirmar en `\d users` que queda `uq_users_tenant_credencial` y desaparece `users_uid_credencial_key`
- [ ] 4.3 Reproducir el caso del log: asignar `6B:E2:61:E7` al usuario 16 del tenant 1 mientras la tiene el usuario 9 del tenant 2 — debe guardar
- [ ] 4.4 Duplicar dentro de un mismo tenant y comprobar que el 400 nombra al portador
- [ ] 4.5 Guardar un usuario sin tocar su credencial y comprobar que no da error
- [ ] 4.6 Repetir 4.3 y 4.4 desde el mantenedor del Super Admin, que es donde falló en producción
