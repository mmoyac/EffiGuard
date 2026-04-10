# EffiGuard — Sistema SaaS de Gestión de Activos

Control de bodega, préstamos de herramientas, inventario de consumibles y prevención de robos para empresas industriales. Arquitectura multi-tenant con RBAC, soporte RFID/QR y PWA para uso en terreno.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend | FastAPI · Python 3.11 · SQLAlchemy 2.0 (async) · Alembic |
| Base de Datos | PostgreSQL 16 |
| Frontend | React 18 · Vite · TypeScript · Tailwind CSS · React Query |
| Iconos | Lucide React |
| Autenticación | JWT (HS256) — access token + refresh token |
| Infraestructura | Docker · Docker Compose |
| PWA | vite-plugin-pwa (manifest + service workers) |

---

## Inicio Rápido

### 1. Requisitos
- Docker Desktop instalado y corriendo
- Git

### 2. Clonar y configurar

```bash
git clone <repo-url>
cd EffiGuard
cp .env.example .env
```

Edita `.env` si necesitas cambiar credenciales. Los valores por defecto funcionan para desarrollo local.

### 3. Levantar todo

```bash
docker compose up --build
```

### 4. Ejecutar migraciones y datos de prueba

```bash
docker compose exec backend alembic upgrade head
```

### 5. Acceder

| Servicio | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| Docs interactivos | http://localhost:8000/docs |
| Base de datos | localhost:5432 |

---

## Variables de Entorno

```env
# Base de Datos
POSTGRES_USER=effiguard
POSTGRES_PASSWORD=supersecret
POSTGRES_DB=effiguard_db

# Backend
SECRET_KEY=<clave_aleatoria_64_chars>
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7
ENVIRONMENT=development

# Frontend
VITE_API_URL=http://localhost:8000/api/v1
```

Generar una `SECRET_KEY` segura:
```bash
openssl rand -hex 32
```

---

## Credenciales Demo

El migration `003_demo_data.py` crea el tenant **"Empresa Demo"** con los siguientes usuarios:

| Rol | Email | Contraseña | UID Credencial |
|-----|-------|-----------|----------------|
| Super Admin | `admin@effiguard.com` | `Admin1234!` | `RFID-ADMIN-001` |
| Bodeguero | `bodega@demo.com` | `Bodega123!` | `RFID-BODEGA-001` |
| Operario | `operario@demo.com` | `Operario1!` | `RFID-OPER-001` |

### UIDs de activos de prueba para el scanner

| UID | Tipo | Descripción |
|-----|------|-------------|
| `QR-TALADRO-001` | Herramienta | Taladro DeWalt DCD777 |
| `QR-AMOLADORA-001` | Herramienta | Amoladora DeWalt DWE402 |
| `QR-DISCO-STOCK` | Consumible | Discos de Corte 115mm (stock: 50) |
| `QR-KIT-AMOLADORA-PADRE` | Kit (padre) | Escanear para prestar kit completo |

---

## Arquitectura Multi-Tenant

Cada request autenticado lleva un JWT con `tenant_id` embebido. El `BaseRepository[T]` filtra automáticamente todas las queries por `tenant_id` — ningún usuario puede ver datos de otro tenant.

```
JWT payload: { sub: user_id, tenant_id, role_id, type: "access" }
```

### Header especial para Super Admin

El Super Admin puede operar dentro de cualquier tenant enviando:
```
X-Acting-Tenant: <tenant_id>
```
El backend reemplaza el `tenant_id` del token por este valor. El frontend lo inyecta automáticamente desde el selector de tenant en el sidebar.

---

## Roles y Permisos (RBAC)

| role_id | Rol | Acceso |
|---------|-----|--------|
| 1 | `super_admin` | Todo el sistema + panel de administración global |
| 2 | `admin` | Todo el tenant (activos, préstamos, inventario, usuarios, proyectos) |
| 3 | `bodeguero` | Dashboard, activos, escanear, préstamos, consumibles, inventario |
| 4 | `operario` | Dashboard, mis préstamos activos |

Los permisos de menú son configurables desde el panel de Super Admin en tiempo real (sin redeploy).

---

## Estructura del Proyecto

```
EffiGuard/
├── backend/
│   ├── app/
│   │   ├── api/v1/
│   │   │   ├── auth.py          # Login, refresh, /me
│   │   │   ├── assets.py        # CRUD activos
│   │   │   ├── loans.py         # Préstamos (crear, devolver, activos)
│   │   │   ├── inventory.py     # Logs de movimientos
│   │   │   ├── users.py         # CRUD usuarios del tenant
│   │   │   ├── projects.py      # CRUD proyectos del tenant
│   │   │   ├── catalog.py       # Marcas, modelos, estados
│   │   │   ├── menu.py          # Menú dinámico por rol
│   │   │   └── superadmin.py    # Panel global (solo super_admin)
│   │   ├── core/
│   │   │   ├── dependencies.py  # CurrentToken, DBSession, X-Acting-Tenant
│   │   │   ├── security.py      # JWT + bcrypt
│   │   │   └── superadmin.py    # SuperAdminToken, ActingTenantId
│   │   ├── models/              # SQLAlchemy ORM (14 tablas)
│   │   ├── repositories/        # BaseRepository con filtro multi-tenant
│   │   ├── schemas/             # Pydantic request/response
│   │   └── services/            # Lógica de negocio
│   └── alembic/versions/
│       ├── 001_initial_schema.py
│       ├── 002_seeds.py           # Roles, estados, módulos, menú, permisos
│       ├── 003_demo_data.py       # Tenant demo + usuarios + activos
│       ├── 004_superadmin_menu.py # Módulo Administración Global (ítems planos)
│       └── 005_admin_menu_group.py # Agrupa ítems admin bajo padre colapsable
│
└── frontend/
    └── src/
        ├── pages/
        │   ├── Login.tsx
        │   ├── Dashboard.tsx
        │   ├── Assets.tsx       # Lista + crear activos + catálogo marcas/modelos
        │   ├── Loans.tsx        # Préstamos activos (bodeguero/admin)
        │   ├── MyLoans.tsx      # Mis préstamos (operario)
        │   ├── Inventory.tsx    # Movimientos de inventario
        │   ├── Scanner.tsx      # Escáner RFID/QR con lógica HID
        │   ├── Users.tsx        # Gestión de usuarios del tenant
        │   ├── Projects.tsx     # Gestión de proyectos del tenant
        │   └── admin/
        │       ├── AdminTenants.tsx
        │       ├── AdminUsers.tsx
        │       ├── AdminAssetStates.tsx
        │       ├── AdminModules.tsx
        │       ├── AdminMenuItems.tsx
        │       └── AdminPermissions.tsx
        ├── components/
        │   ├── layout/
        │   │   ├── Layout.tsx   # Shell: sidebar colapsable + topbar móvil
        │   │   └── Sidebar.tsx  # Menú dinámico + selector de tenant (super admin)
        │   └── scanner/
        │       └── ScanResult.tsx
        ├── hooks/
        │   ├── useMenu.ts       # Menú server-driven por role_id
        │   └── useHIDScanner.ts # Diferencia lector RFID vs teclado manual
        ├── stores/
        │   ├── authStore.ts     # Zustand: usuario, tokens, logout
        │   └── tenantStore.ts   # Zustand: acting tenant del super admin
        └── services/
            └── api.ts           # Axios + interceptores (token + X-Acting-Tenant)
```

---

## Modelo de Datos

14 tablas normalizadas en PostgreSQL:

```
tenants → users → roles
                → assets → asset_states
                         → brands → asset_model
                         → loans → projects
                         → inventory_logs
modules → menu_items → role_menu_permissions
tenants → subscriptions
```

### Tipos de activos

- **Herramienta**: requiere préstamo (`loans`). Cambia estado entre Disponible ↔ En Terreno.
- **Consumible**: solo descuenta `stock_actual` y genera log en `inventory_logs`. No crea préstamo.
- **Kit**: herramienta con activos hijo (`parent_asset_id`). Un solo escaneo del padre genera préstamos para todos los hijos.

---

## API Endpoints Principales

### Autenticación
```
POST /api/v1/auth/login          # { email, password } → { access_token, refresh_token }
POST /api/v1/auth/refresh        # { refresh_token } → nuevos tokens
GET  /api/v1/auth/me             # Usuario autenticado + nombre del tenant
```

### Activos
```
GET    /api/v1/assets/           # Lista activos del tenant
POST   /api/v1/assets/           # Crear activo
GET    /api/v1/assets/scan/{uid} # Resolver escaneo RFID/QR
GET    /api/v1/assets/low-stock  # Consumibles bajo stock mínimo
PATCH  /api/v1/assets/{id}       # Actualizar activo
```

### Préstamos
```
GET  /api/v1/loans/                        # Lista préstamos (filtrable ?active_only=true)
POST /api/v1/loans/                        # Crear préstamo (herramienta o kit)
POST /api/v1/loans/consumables/withdraw    # Retirar consumibles
GET  /api/v1/loans/my                      # Préstamos del operario autenticado
GET  /api/v1/loans/active/asset/{id}       # Préstamo activo por activo
POST /api/v1/loans/{id}/return             # Devolver herramienta
```

### Catálogo
```
GET  /api/v1/catalog/brands     # Marcas del tenant
POST /api/v1/catalog/brands     # Crear marca
GET  /api/v1/catalog/models     # Modelos (filtrable ?brand_id=)
POST /api/v1/catalog/models     # Crear modelo
GET  /api/v1/catalog/states     # Estados de activo (global)
```

### Super Admin (requiere role_id = 1)
```
GET/POST/PATCH  /api/v1/admin/tenants              # CRUD tenants
GET             /api/v1/admin/tenants/{id}/summary # Resumen del tenant
GET/POST/PATCH  /api/v1/admin/users                # Usuarios globales
GET             /api/v1/admin/roles                # Roles del sistema
GET/POST/PATCH/DELETE /api/v1/admin/asset-states   # Estados de activo
GET/POST/PATCH/DELETE /api/v1/admin/modules        # Módulos de navegación
GET/POST/PATCH/DELETE /api/v1/admin/menu-items     # Ítems de menú
GET/PUT         /api/v1/admin/permissions          # Permisos por rol
```

---

## Scanner RFID / QR

El hook `useHIDScanner` diferencia un lector HID externo del teclado manual midiendo el tiempo entre keystrokes:
- **< 80ms entre caracteres** → lector RFID/QR → dispara escaneo automático
- **≥ 80ms** → escritura manual → no dispara

Flujo de escaneo (bodeguero):
1. Escanear activo → identifica tipo y estado actual
2. Si disponible → seleccionar operario y proyecto → crear préstamo
3. Si en terreno → mostrar quién lo tiene → ofrecer devolución
4. Si consumible → pedir cantidad → descontar stock

---

## Navegación Dinámica (Server-Driven UI)

El menú lateral no está hardcodeado en el frontend. Se construye consumiendo:
```
GET /api/v1/menu/
```
que retorna solo los ítems permitidos para el `role_id` del token. Cualquier cambio de permisos desde el panel de Super Admin se refleja en el próximo refresh del menú, sin redeploy.

### Agregar una nueva ruta al módulo Administración

**Opción A — Migración** (recomendado para cambios permanentes):

Crear `backend/alembic/versions/00X_descripcion.py`:

```python
def upgrade() -> None:
    conn = op.get_bind()

    mod_id = conn.execute(
        sa.text("SELECT id FROM modules WHERE nombre = 'Administración'")
    ).scalar()

    parent_id = conn.execute(
        sa.text("SELECT id FROM menu_items WHERE ruta = '' AND label = 'Administración'")
    ).scalar()

    conn.execute(sa.text(f"""
        INSERT INTO menu_items (module_id, parent_id, label, ruta, icono, orden)
        VALUES ({mod_id}, {parent_id}, 'Mi Sección', '/admin/mi-seccion', 'Settings', 108)
    """))

    conn.execute(sa.text("""
        INSERT INTO role_menu_permissions (role_id, menu_item_id)
        SELECT r.id, m.id FROM roles r, menu_items m
        WHERE r.nombre = 'super_admin' AND m.ruta = '/admin/mi-seccion'
        ON CONFLICT DO NOTHING
    """))
```

```bash
docker compose exec backend alembic upgrade head
```

**Opción B — SQL directo** (para pruebas rápidas):

```bash
docker compose exec postgres psql -U effiguard -d effiguard_db
```

```sql
-- Obtener IDs de referencia
SELECT id FROM modules WHERE nombre = 'Administración';
SELECT id FROM menu_items WHERE ruta = '' AND label = 'Administración';

-- Insertar ítem (reemplazar mod_id y parent_id con los valores obtenidos)
INSERT INTO menu_items (module_id, parent_id, label, ruta, icono, orden)
VALUES (<mod_id>, <parent_id>, 'Mi Sección', '/admin/mi-seccion', 'Settings', 108);

-- Dar permiso al super_admin
INSERT INTO role_menu_permissions (role_id, menu_item_id)
SELECT r.id, m.id FROM roles r, menu_items m
WHERE r.nombre = 'super_admin' AND m.ruta = '/admin/mi-seccion';
```

**Iconos:** usar el nombre exacto del componente de [Lucide React](https://lucide.dev/icons/) — ej: `Settings`, `Database`, `Lock`, `BarChart2`, `FileText`, `Users`.

---

## UX / UI

- **Modo oscuro** por defecto (ahorro de batería en terreno)
- **Mobile-first**: botones mínimo 48px, sin scroll horizontal
- **Sidebar colapsable**: en desktop se colapsa a íconos (w-16), en móvil es overlay deslizante
- **Sin tablas**: todas las vistas usan cards responsive

---

## Comandos Útiles

```bash
# Levantar servicios
docker compose up

# Reconstruir imágenes
docker compose up --build

# Ejecutar migraciones
docker compose exec backend alembic upgrade head

# Ver logs
docker compose logs -f backend
docker compose logs -f frontend

# Conectar a la base de datos
docker compose exec postgres psql -U effiguard -d effiguard_db

# Reiniciar un servicio
docker compose restart backend
docker compose restart frontend

# Detener todo
docker compose down

# Detener y eliminar volúmenes (reset completo de BD)
docker compose down -v
```

---

## Agregar un Nuevo Tenant

1. Ingresar como Super Admin (`admin@effiguard.com`)
2. Ir a **Administración → Tenants → Nuevo**
3. Completar nombre empresa, RUT, slug y plan
4. Ir a **Administración → Usuarios Global → Nuevo**
5. Seleccionar el tenant recién creado, asignar rol Admin y crear usuario
6. Ingresar con el nuevo usuario Admin
7. En **Activos → Marcas y Modelos** crear el catálogo del tenant
8. Crear activos, proyectos y usuarios del tenant

---

## Licencia

Proyecto privado — todos los derechos reservados.
