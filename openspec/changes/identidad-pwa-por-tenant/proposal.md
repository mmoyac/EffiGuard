## Why

El ícono con que la app queda instalada en el teléfono es lo único que el operario ve antes de abrirla, y hoy es el mismo dibujo genérico para todos los tenants. `tenants.logo_url` existe, el Super Admin ya puede subir el logo y el proxy `/static` ya lo sirve — pero `/api/v1/pwa/manifest/{tenant_id}` devuelve una constante `_BASE_ICONS` y nunca lo mira. La identidad del tenant se quedó en el texto.

Peor: el manifiesto sólo se reemplaza **después** del login, y el momento natural para instalar la PWA es la pantalla de login, cuando el navegador ofrece el prompt. Quien instala ahí queda con el ícono y el nombre genéricos para siempre, porque ni Android ni iOS renombran un ícono ya instalado. El dato para evitarlo estaba disponible todo el tiempo: el despliegue es un subdominio por tenant y `_extract_slug()` ya resuelve el tenant desde el `Host` sin autenticación.

Y el reparto de identidad está al revés de lo que se quiere: hoy la glosa bajo el ícono dice el nombre de la empresa y la imagen es genérica. Debe ser al revés — la imagen identifica a la empresa, el texto dice "EffiGuard".

## What Changes

- El manifiesto SHALL resolver el tenant desde el `Host` de la petición, no desde un `tenant_id` en la ruta. Queda servible en la primera carga, antes de cualquier login.
- **BREAKING** — `GET /api/v1/pwa/manifest/{tenant_id}` se reemplaza por `GET /api/v1/pwa/manifest`. El frontend deja de construir la URL con el `tenant_id` de la sesión.
- **BREAKING** — el `short_name` deja de ser el nombre de la empresa y pasa a ser `"EffiGuard"` fijo. La empresa se reconoce por la imagen. El `name` largo sigue siendo `"EffiGuard · {empresa}"` para el diálogo de instalación y la lista de apps del sistema.
- Los íconos del manifiesto SHALL derivarse de `tenants.logo_url`: el backend genera PNG de 192 y 512 px componiendo el logo sobre `#111827` con la zona segura que exige `maskable`. Nueva dependencia `pillow`.
- Se separan las entradas `purpose: "any"` y `purpose: "maskable"`, que hoy van fusionadas en una sola — con `"any maskable"` Android aplica el recorte circular también al ícono plano.
- El `apple-touch-icon` SHALL apuntar al ícono del tenant desde la carga inicial, para que iOS lo tome al "Agregar a inicio". Hoy es estático en `index.html`.
- El label de iOS (`apple-mobile-web-app-title`) pasa a `"EffiGuard"`, alineado con el `short_name`.
- Un tenant sin logo, inexistente o inactivo SHALL recibir los íconos genéricos actuales. Sin errores, sin ícono roto.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `experiencia-industrial`: el manifiesto se resuelve por subdominio en vez de por `tenant_id` post-login; los íconos salen del logo del tenant; el reparto nombre/imagen se invierte. Además se corrige el requisito de auto-actualización del service worker, que dejó de describir el comportamiento real (ver Impact).
- `administracion-tenant`: subir o reemplazar el logo SHALL invalidar los íconos PWA derivados de ese tenant.

## Impact

**Base de datos** — ninguna. `tenants.logo_url` ya existe y ya se puebla.

**Backend** — `api/v1/pwa.py` (reescritura: resolución por Host, generación de íconos, caché en disco), `api/v1/superadmin.py` (`upload_tenant_logo` invalida los derivados), `requirements.txt` (`pillow`). La resolución por Host reusa `_extract_slug()` de `services/auth.py`, que conviene mover a un módulo compartido en vez de importarlo desde el servicio de autenticación.

**Frontend** — `hooks/usePWAManifest.ts` (deja de depender de `user`, pasa a apuntar al endpoint fijo), `index.html` (el `<link rel="manifest">` apunta al endpoint dinámico desde el arranque).

**Infra** — `nginx.prod.conf`: los íconos derivados se sirven vía backend y necesitan una regla de caché acorde a que cambian cuando cambia el logo.

**Riesgo** — medio, por un detalle de caché: el ícono de una PWA instalada es de lo más difícil de refrescar en el ecosistema móvil. Si se sirven los íconos derivados con caché larga y un tenant corrige su logo, los teléfonos ya instalados pueden quedar con el anterior indefinidamente. El diseño debe versionar la URL del ícono, no confiar en la revalidación.

**Deuda que este change salda a medias** — el arreglo del flujo de actualización del service worker (paso de `registerType: "autoUpdate"` a `"prompt"` con aviso al usuario, y las cabeceras `Cache-Control` de `index.html`/`sw.js` en nginx) ya está implementado en el árbol de trabajo pero nunca tuvo change propio. Su requisito en `experiencia-industrial` hoy dice "service worker de auto-actualización", que ya no es cierto. Se corrige aquí porque toca el mismo archivo de spec y dejarlo divergente haría fallar la próxima lectura de esa spec.
