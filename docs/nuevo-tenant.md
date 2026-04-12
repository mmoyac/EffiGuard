# Crear un nuevo tenant en EffiGuard

## Requisitos previos
- Acceso SSH al VPS (`168.231.96.205`)
- Acceso a Cloudflare (DNS de `lexastech.cl`)
- El deploy de EffiGuard debe estar corriendo en el VPS

---

## Paso 1 — Crear registro DNS en Cloudflare

1. Ir a **Cloudflare → lexastech.cl → DNS → Add record**
2. Completar:

| Campo | Valor |
|---|---|
| Type | `A` |
| Name | `effiguard-{slug}` (ej: `effiguard-propublix`) |
| IPv4 address | `168.231.96.205` |
| Proxy status | **DNS only** (nube gris, NO naranja) |

3. Guardar.

> El slug debe ser único, sin espacios, solo letras minúsculas, números y guiones.  
> Ejemplos válidos: `propublix`, `gontec`, `cliente-abc`

---

## Paso 2 — Registrar el subdominio en nginx

En el VPS ejecutar:

```bash
sh /root/docker/EffiGuard/scripts/add-tenant.sh {slug}
```

Ejemplo:
```bash
sh /root/docker/EffiGuard/scripts/add-tenant.sh propublix
```

Esto crea la configuración nginx para `effiguard-propublix.lexastech.cl` y recarga nginx automáticamente. El subdominio queda operativo con HTTPS (wildcard cert `*.lexastech.cl`).

---

## Paso 3 — Crear el tenant en la base de datos

```bash
docker exec -it effiguard_db psql -U effiguard effiguard_prod
```

```sql
INSERT INTO tenants (nombre_empresa, rut_empresa, slug, is_active, plan_type)
VALUES (
  'Nombre Empresa SpA',   -- nombre visible
  '76.123.456-7',         -- RUT empresa (único)
  'propublix',            -- debe coincidir con el slug del DNS y nginx
  true,
  'basic'                 -- opciones: basic, pro, enterprise
);
```

Salir de psql:
```sql
\q
```

---

## Paso 4 — Crear el usuario administrador del tenant

Primero obtener el `tenant_id` recién creado:

```sql
SELECT id, nombre_empresa, slug FROM tenants ORDER BY id DESC LIMIT 5;
```

Luego crear el usuario admin (role_id 2 = admin del tenant):

```sql
INSERT INTO users (tenant_id, nombre, email, password_hash, role_id, is_active)
VALUES (
  {tenant_id},
  'Nombre Admin',
  'admin@empresa.cl',
  crypt('password_temporal', gen_salt('bf')),  -- cambiar en primer login
  2,
  true
);
```

> Si `crypt` no está disponible, generar el hash desde el VPS:
> ```bash
> docker exec effiguard_backend python -c "from app.core.security import get_password_hash; print(get_password_hash('password_temporal'))"
> ```
> Y usar ese hash en el INSERT.

---

## Paso 5 — Verificar acceso

Abrir en el navegador:
```
https://effiguard-{slug}.lexastech.cl
```

Ingresar con el email y password creados en el paso 4.

---

## Resumen rápido

```
1. Cloudflare DNS → A record effiguard-{slug} → 168.231.96.205
2. VPS → sh /root/docker/EffiGuard/scripts/add-tenant.sh {slug}
3. DB  → INSERT INTO tenants (...)
4. DB  → INSERT INTO users (...)
5. Verificar en https://effiguard-{slug}.lexastech.cl
```
