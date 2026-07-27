# Autenticación y Roles Specification

## Purpose

Autenticar usuarios contra el tenant correcto, emitir tokens JWT con el contexto necesario para el aislamiento multi-tenant, y definir los cuatro roles del sistema.

## Requirements

### Requirement: Login con email y contraseña

El sistema SHALL autenticar con email + contraseña contra hash bcrypt (cost 12) y devolver un par access/refresh token.

#### Scenario: Credenciales válidas

- **WHEN** el email existe en el tenant resuelto y la contraseña coincide con `password_hash`
- **THEN** responde 200 con `access_token` y `refresh_token`

#### Scenario: Email inexistente o contraseña incorrecta

- **WHEN** el usuario no existe o la contraseña no coincide
- **THEN** responde 401 con el mismo mensaje "Credenciales incorrectas" en ambos casos, para no revelar qué emails existen

#### Scenario: Usuario desactivado

- **WHEN** las credenciales son correctas pero `is_active = false`
- **THEN** responde 403 con "Tu cuenta está desactivada. Contacta al administrador."

### Requirement: Login con Google OAuth

El sistema SHALL aceptar un `id_token` de Google, verificarlo contra `GOOGLE_CLIENT_ID` y emitir tokens propios para el usuario cuyo email coincida. No crea usuarios: el email debe existir previamente.

#### Scenario: Token de Google válido y usuario existente

- **WHEN** el `id_token` verifica y su email corresponde a un usuario activo del tenant
- **THEN** responde 200 con el par de tokens de EffiGuard

#### Scenario: Email de Google sin cuenta en el sistema

- **WHEN** el token verifica pero ningún usuario tiene ese email
- **THEN** responde 401 con "No existe una cuenta con este email"

#### Scenario: Google no configurado

- **WHEN** `GOOGLE_CLIENT_ID` no está definido en el entorno
- **THEN** responde 501 con "Google login no configurado"

#### Scenario: Token de Google inválido

- **WHEN** la verificación del `id_token` falla
- **THEN** responde 401 con "Token de Google inválido"

### Requirement: Super Admin autenticable desde cualquier subdominio

Cuando el login se hace desde el subdominio de un tenant y el email no pertenece a ese tenant, el sistema SHALL buscar como fallback un usuario con `role_id == 1`. Aplica tanto al login con contraseña como al de Google.

#### Scenario: Super Admin entra por el subdominio de un cliente

- **WHEN** el Super Admin hace login en `effiguard-demo.effi4tech.cl` y su usuario no pertenece al tenant `demo`
- **THEN** el fallback lo encuentra por email + `role_id == 1` y la autenticación tiene éxito

### Requirement: Tokens JWT con contexto de tenant y rol

El `access_token` SHALL ser un JWT HS256 con payload `sub` (user_id), `tenant_id`, `role_id`, `type: "access"` y expiración configurable (60 min por defecto). El `refresh_token` lleva sólo `sub` y `type: "refresh"` (7 días por defecto).

#### Scenario: Token de tipo incorrecto en endpoint protegido

- **WHEN** se envía un refresh token como Bearer en un endpoint protegido
- **THEN** responde 401 con "Token de tipo incorrecto"

#### Scenario: Token expirado o firma inválida

- **WHEN** el token no decodifica con `SECRET_KEY`
- **THEN** responde 401 con "Token inválido o expirado" y cabecera `WWW-Authenticate: Bearer`

### Requirement: Refresco de sesión

El endpoint `POST /api/v1/auth/refresh` SHALL emitir un nuevo par de tokens a partir de un refresh token válido de un usuario activo.

#### Scenario: Refresh token de usuario desactivado

- **WHEN** el usuario asociado al refresh token ya no está activo
- **THEN** responde 401 con "Usuario no encontrado"

#### Scenario: Renovación transparente en el frontend

- **WHEN** una respuesta de la API devuelve 401 y hay refresh token en `localStorage`
- **THEN** el interceptor de axios refresca los tokens y reintenta la petición original una sola vez; si el refresco falla, limpia el storage y redirige a `/login`

### Requirement: Perfil del usuario autenticado

`GET /api/v1/auth/me` SHALL devolver id, nombre, email, `role_id`, `tenant_id`, nombre y logo del tenant, y `uid_credencial`.

#### Scenario: Carga inicial de la SPA

- **WHEN** la aplicación arranca con sesión activa
- **THEN** consulta `/auth/me` para hidratar el store; si falla, cierra sesión

### Requirement: Catálogo de roles

El sistema SHALL definir cuatro roles globales con IDs estables: 1 `super_admin`, 2 `admin`, 3 `bodeguero`, 4 `operario`.

#### Scenario: Operario entra a la aplicación

- **WHEN** un usuario con `role_id == 4` accede a la raíz
- **THEN** se le redirige a `/my-loans` en lugar del dashboard

#### Scenario: Acción reservada a administradores

- **WHEN** un usuario con `role_id > 2` intenta crear, listar o revocar API keys
- **THEN** responde 403 con "Solo administradores"
