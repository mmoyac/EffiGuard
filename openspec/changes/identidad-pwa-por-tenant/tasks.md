## 1. Resolución de tenant por Host

- [x] 1.1 Crear `backend/app/core/tenant_host.py` con `extract_slug(host)` y `resolve_tenant_optional(slug, session)`, este último devolviendo `None` en vez de lanzar 404
- [x] 1.2 Mover `_SLUG_RE` y `_extract_slug` desde `services/auth.py` al módulo nuevo, dejando `auth.py` importándolos
- [x] 1.3 Verificar que el login por subdominio sigue funcionando tras el movimiento

## 2. Generación de íconos derivados

- [x] 2.1 Agregar `pillow` a `backend/requirements.txt`
- [x] 2.2 Crear `backend/app/services/pwa_icons.py` con `generar_derivados(logo_path, slug) -> list[str] | None`, que compone sobre `#111827` en `contain`: variante `any` al 100% del lienzo y `maskable` al 80% central, en 192 y 512 px
- [x] 2.3 Nombrar los archivos `{slug}-{hash8}-{size}-{purpose}.png` bajo `/static/pwa-icons/`, con `hash8` = primeros 8 chars del SHA-256 del logo de origen
- [x] 2.4 Devolver `None` sin propagar excepción cuando el origen no se puede abrir (caso SVG), y registrar el motivo en el log
- [x] 2.5 Añadir `eliminar_derivados(slug, hash8)` para limpiar los archivos de un logo reemplazado

## 3. Endpoint del manifiesto

- [x] 3.1 Reescribir `backend/app/api/v1/pwa.py`: `GET /pwa/manifest` sin parámetros, resolviendo el tenant desde el header `Host`
- [x] 3.2 Fijar `short_name` en `"EffiGuard"` y `name` en `"EffiGuard · {nombre_empresa}"` (o `"EffiGuard"` a secas si no hay tenant)
- [x] 3.3 Emitir las entradas de íconos con `purpose: "any"` y `purpose: "maskable"` separadas, apuntando a los derivados del tenant
- [x] 3.4 Degradar a `/icons/icon-{192,512}.png` si no hay tenant, no hay `logo_url`, o los derivados no existen en disco
- [x] 3.5 Conservar `Cache-Control: no-cache, no-store, must-revalidate` y `Content-Type: application/manifest+json`
- [x] 3.6 Añadir `GET /pwa/apple-touch-icon` que resuelve por `Host` y responde 302 al derivado `any` de 192px, o al genérico si no aplica
- [x] 3.7 Eliminar `GET /pwa/manifest/{tenant_id}`

## 4. Carga de logo del Super Admin

- [x] 4.1 En `upload_tenant_logo` (`api/v1/superadmin.py`), generar los derivados tras guardar el logo nuevo
- [x] 4.2 Eliminar los derivados del logo anterior junto con el archivo original
- [x] 4.3 Envolver la generación de modo que un fallo no haga fracasar la carga del logo

## 5. Backfill de tenants existentes

- [x] 5.1 Crear script idempotente que recorra los tenants con `logo_url` y genere sus derivados si faltan
- [x] 5.2 Ejecutarlo y verificar que los tenants con logo dejan de servir íconos genéricos

## 6. Frontend

- [x] 6.1 Poner `manifest: false` en la config de `VitePWA` para que deje de emitir e inyectar el manifiesto estático
- [x] 6.2 Declarar `<link rel="manifest" href="/api/v1/pwa/manifest" />` en `frontend/index.html`
- [x] 6.3 Apuntar `<link rel="apple-touch-icon">` a `/api/v1/pwa/apple-touch-icon`
- [x] 6.4 Quitar de `usePWAManifest()` la reescritura del `href` del manifiesto; dejar sólo `document.title` y fijar `apple-mobile-web-app-title` en `"EffiGuard"`
- [x] 6.5 Confirmar que no queda ningún `<link rel="manifest">` duplicado en el `index.html` construido

## 7. Infraestructura

- [x] 7.1 Añadir en `nginx.prod.conf` la regla de caché para `/static/pwa-icons/` con `immutable`, que es seguro por el versionado por hash
- [x] 7.2 Verificar que `/api/v1/pwa/manifest` sale con `no-cache` y no lo pisa ninguna regla de assets

## 8. Verificación

- [x] 8.1 Instalar la PWA desde el subdominio de un tenant con logo, **sin iniciar sesión**, y comprobar ícono del tenant y glosa "EffiGuard"
- [x] 8.2 Comprobar que el diálogo de instalación muestra "EffiGuard · {empresa}"
- [x] 8.3 Instalar desde un tenant sin logo y comprobar que sale el ícono genérico sin errores en consola
- [x] 8.4 Cambiar el logo de un tenant y comprobar que las URLs de los derivados cambian
- [x] 8.5 Revisar en DevTools → Application → Manifest que los íconos `any` y `maskable` se listan por separado y ambos cargan

## 9. Persistencia y despliegue automático

- [x] 9.1 Montar volumen `backend_static` en `/app/static` en `docker-compose.prod.yml`: sin él, `up --force-recreate` borraba los logos subidos en cada despliegue
- [x] 9.2 Declarar el volumen en la sección `volumes:` del compose
- [x] 9.3 Ejecutar el backfill desde el workflow tras el chequeo de contenedores, sin abortar el despliegue si falla
- [x] 9.4 Verificar que el volumen preserva los archivos a través de un recreate

## 10. Spec

- [x] 10.1 Confirmar que el requisito *Aplicación instalable como PWA* ya describe el flujo `prompt` implementado, sin trabajo de código asociado
