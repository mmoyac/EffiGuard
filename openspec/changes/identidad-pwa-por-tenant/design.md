## Context

El manifiesto PWA hoy vive en `GET /api/v1/pwa/manifest/{tenant_id}` y sólo personaliza texto: arma `name` y `short_name` desde `tenants.nombre_empresa` y devuelve una constante `_BASE_ICONS` apuntando a `/icons/icon-{192,512}.png`, los PNG genéricos que `generate-pwa-icons.mjs` produce desde `docs/Effiguard-icon.jpg`.

El frontend apunta ese endpoint reescribiendo el `href` del `<link rel="manifest">` desde `usePWAManifest()`, que depende de `user?.tenant_id` y por lo tanto no corre hasta después del login.

Tres restricciones mandan sobre el diseño:

- **El ícono se decide antes de la sesión.** El navegador resuelve el manifiesto en la carga de la página; el prompt de instalación aparece típicamente en el login. Cualquier solución que dependa del token llega tarde.
- **El tenant es conocido sin autenticación.** El despliegue es `effiguard-{slug}.effi4tech.cl` y `_extract_slug()` en `services/auth.py` ya lo deriva del `Host`. El dato está disponible en la primera petición.
- **Un ícono instalado casi no se refresca.** Android relee el manifiesto de forma oportunista y iOS prácticamente nunca vuelve a pedir el `apple-touch-icon`. Todo lo que se sirva bajo una URL estable queda congelado en los teléfonos ya instalados.

`tenants.logo_url` se puebla desde `upload_tenant_logo` en `superadmin.py`, acepta PNG/JPEG/WebP/SVG de dimensiones arbitrarias y guarda bajo `/static/logos/`.

## Goals / Non-Goals

**Goals:**

- Que el ícono correcto del tenant esté disponible en la **primera** carga, sin sesión.
- Invertir el reparto de identidad: la imagen identifica a la empresa, el texto dice "EffiGuard".
- Que un cambio de logo se propague a instalaciones existentes en todo lo que el ecosistema móvil permita, y que donde no se pueda, sea una limitación conocida y no un bug latente.
- Que un tenant sin logo, inactivo o inexistente degrade a los íconos genéricos sin error.

**Non-Goals:**

- Personalizar `theme_color` / `background_color` por tenant. La UI es modo oscuro forzado (`#111827`) y un color por tenant rompería el arranque de la app.
- Permitir que el propio tenant (admin) suba su logo. Sigue siendo atribución exclusiva del Super Admin.
- Refrescar el ícono de una PWA ya instalada en iOS. Ver Risks.
- Reemplazar los íconos genéricos de `public/icons/`. Siguen siendo el fallback y el ícono del dominio base.

## Decisions

### 1. El manifiesto resuelve el tenant por `Host`, no por ruta

`GET /api/v1/pwa/manifest` sin parámetros. El slug sale del header `Host`.

`_extract_slug()` y `_resolve_tenant()` se mueven de `services/auth.py` a `core/tenant_host.py`. Que el módulo de PWA importe del servicio de autenticación para leer un header sería una dependencia invertida: resolver el tenant desde el host es infraestructura, no una regla de login.

*Alternativa descartada:* dejar `{tenant_id}` en la ruta y que el frontend lo complete tras el login. Es lo que hay hoy y es exactamente la causa de que el primer install salga genérico.

*Alternativa descartada:* servir `/manifest.webmanifest` desde el backend vía proxy nginx, conservando la ruta canónica. El service worker precachea esa ruta en tiempo de build; apuntarla a contenido dinámico mete un documento por tenant dentro de una entrada de precache con revisión fija. Se prefiere una ruta nueva y dejar la estática como lo que es, un artefacto de build.

### 2. `manifest: false` en VitePWA y `<link>` explícito en `index.html`

vite-plugin-pwa inyecta su propio `<link rel="manifest" href="/manifest.webmanifest">` en el `index.html` construido. Como el navegador honra **el primero** que encuentra, tener dos links es una carrera silenciosa.

Se desactiva la generación del manifiesto estático (`manifest: false`) y `index.html` declara directamente:

```html
<link rel="manifest" href="/api/v1/pwa/manifest" />
```

Sin JavaScript de por medio: el manifiesto correcto está en el HTML desde el primer byte.

*Alternativa descartada:* conservar el link inyectado y reescribir el `href` con un `<script>` inline en el `<head>`. Funciona, pero deja el resultado dependiendo de cuándo el navegador decide leer el manifiesto respecto de la ejecución del script — precisamente la clase de carrera que este change existe para eliminar.

El costo es que el manifiesto deja de estar precacheado y no se resuelve sin red. Es aceptable: instalar una PWA requiere conexión de todos modos.

### 3. Los íconos se derivan al subir el logo, no bajo demanda

`upload_tenant_logo` genera, además de guardar el original, cuatro PNG con Pillow bajo `/static/pwa-icons/`.

La alternativa de generar en la petición del ícono obliga a inventar caché, manejar peticiones concurrentes sobre el mismo tenant y aceptar latencia de composición justo en el instante de instalar. Derivar en la subida convierte los íconos en archivos estáticos comunes, servidos por el `StaticFiles` que ya está montado y cacheados por la regla de nginx que ya existe.

Consecuencia a cubrir: los tenants con logo ya cargado no tienen derivados. Se resuelve con un script de backfill idempotente, más la regla de degradación del punto 6 para que la ausencia nunca sea un 404.

### 4. La URL del ícono lleva el hash del logo

```
/static/pwa-icons/{slug}-{hash8}-{size}-{purpose}.png
```

donde `hash8` son los primeros 8 caracteres del SHA-256 del archivo original.

Este es el punto que resuelve el riesgo declarado en el proposal. Con nombre versionado por contenido:

- cambiar el logo produce URLs nuevas, así que un cliente que relee el manifiesto ve rutas que nunca cacheó;
- las rutas viejas pueden servirse con caché inmutable sin miedo, porque su contenido no cambia jamás;
- no hace falta invalidación activa en ninguna capa.

*Alternativa descartada:* ruta estable `/static/pwa-icons/{slug}-192.png` con `Cache-Control` corto. Obliga a revalidar en cada carga para siempre a cambio de un evento —el cambio de logo— que ocurre casi nunca, y aun así no garantiza el refresco en dispositivos instalados.

Los derivados anteriores se borran al reemplazar el logo, igual que ya hace `upload_tenant_logo` con el original.

### 5. `any` y `maskable` son entradas separadas

Hoy ambos íconos declaran `purpose: "any maskable"`. Eso le dice al navegador que el mismo archivo sirve para las dos cosas, y Android termina aplicando el recorte adaptativo (círculo de 80% de diámetro) también al ícono plano, comiéndose los bordes del logo.

Se generan dos familias:

| purpose    | composición                                                        |
|------------|--------------------------------------------------------------------|
| `any`      | logo en `contain` al 100% del lienzo, fondo `#111827`               |
| `maskable` | logo en `contain` al 80% centrado, fondo `#111827` hasta los bordes |

El 80% es la zona segura que define la especificación de maskable icons: todo lo que quede fuera puede ser recortado por la máscara del sistema.

En `contain` un logo rectangular conserva su proporción y se rellena con el fondo — nunca se deforma.

### 6. Degradación a los íconos genéricos

El manifiesto usa `/icons/icon-{192,512}.png` cuando el tenant no se resuelve (dominio base, slug desconocido, tenant inactivo), cuando no tiene `logo_url`, o cuando los archivos derivados no existen en disco.

Esa última condición es la que hace segura la migración: mientras el backfill no haya corrido, los tenants existentes ven exactamente lo de hoy en vez de un ícono roto.

### 7. iOS: `apple-touch-icon` por redirección

iOS ignora el manifiesto para el ícono de "Agregar a inicio" y usa `<link rel="apple-touch-icon">`, que debe estar en el documento. Como `index.html` es un artefacto de build compartido por todos los subdominios, no puede llevar la URL versionada.

Se declara una ruta estable que resuelve por `Host` y responde `302` hacia el PNG versionado:

```html
<link rel="apple-touch-icon" href="/api/v1/pwa/apple-touch-icon" />
```

Se usa el derivado `any` de 192px: iOS aplica su propia máscara de esquinas redondeadas y no entiende `maskable`.

### 8. Qué queda de `usePWAManifest()`

El hook deja de tocar el `<link rel="manifest">` — ya no hay nada que intercambiar. Le queda sólo el `document.title` (`"EffiGuard · {empresa}"`, útil como título de pestaña en escritorio), y fija `apple-mobile-web-app-title` en `"EffiGuard"` para que el label de iOS concuerde con el `short_name` del manifiesto.

### 9. Corrección del requisito de auto-actualización

El requisito *Aplicación instalable como PWA* declara "service worker de auto-actualización". El comportamiento real, ya implementado, es `registerType: "prompt"`: el service worker nuevo espera y un aviso ofrece recargar, porque con `skipWaiting` automático el worker nuevo tomaba control de una pestaña que seguía ejecutando el bundle viejo y `cleanupOutdatedCaches()` ya había borrado sus chunks.

Se actualiza el texto del requisito para que describa lo que el sistema hace. No hay trabajo de implementación asociado.

## Risks / Trade-offs

**Un logo con transparencia sobre fondo oscuro puede quedar ilegible** → La composición fuerza `#111827` de fondo, que es el color de la app. Un logo pensado para papel blanco (tinta negra, transparente alrededor) desaparece. No hay forma programática confiable de detectarlo; se mitiga documentando el requisito en la vista de carga de logo del Super Admin, que es donde se puede ver el resultado antes de confirmar.

**El ícono de una PWA ya instalada en iOS no se refresca** → Safari cachea el `apple-touch-icon` de forma prácticamente permanente y no reevalúa el ícono del home screen. Un tenant que corrija su logo verá el anterior en los iPhones ya instalados hasta que el usuario reinstale. Se acepta: es una limitación de la plataforma, no del diseño. La redirección `302` deja al menos la puerta abierta a que Safari lo reintente.

**Android relee el manifiesto de forma oportunista** → El nombre y el ícono de una instalación existente se actualizan cuando Chrome decide, no cuando se sube el logo. El versionado por hash asegura que cuando ocurra, el resultado sea el correcto.

**SVG como logo de origen** → El upload acepta SVG y Pillow no rasteriza SVG sin dependencias extra. Se decide **no** agregar `cairosvg`: un SVG cuyo derivado no se puede generar cae en la regla de degradación (punto 6) y el tenant conserva los íconos genéricos, igual que hoy. Añadir un rasterizador vectorial por un caso de borde no justifica su superficie.

**El manifiesto deja de estar precacheado** → Un dispositivo sin red no puede resolverlo. Sólo afecta al momento de instalar, que requiere conexión de todas formas. Ninguna vista de la app depende del manifiesto en runtime.

**Superficie sin autenticar** → El endpoint del manifiesto ya es público por diseño y sigue exponiendo únicamente el nombre de empresa. Los íconos derivados se sirven desde `/static`, tan público como los logos que ya están ahí. No hay cambio en el modelo de exposición.

## Migration Plan

1. Desplegar backend con el endpoint nuevo y `pillow`. El endpoint viejo por `tenant_id` puede convivir un despliegue si se quiere evitar acoplar los dos artefactos.
2. Correr el backfill de derivados sobre los tenants con `logo_url`. Es idempotente y sólo lee `/static/logos/`.
3. Desplegar frontend con el `<link>` nuevo.
4. Retirar `GET /api/v1/pwa/manifest/{tenant_id}`.

**Rollback:** revertir el frontend basta. El `index.html` anterior apunta a `/manifest.webmanifest` y los archivos derivados en `/static/pwa-icons/` quedan huérfanos sin afectar nada.

## Open Questions

- ¿Debe la vista del Super Admin previsualizar cómo queda el logo compuesto sobre `#111827` con la zona segura de maskable? Es la única mitigación real del primer riesgo, pero es trabajo de UI que puede ir en un change aparte.
