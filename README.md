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

### Datos de prueba para el escáner

El catálogo demo se carga desde **Catálogo → Descargar template**, que trae filas
de ejemplo con las familias reales del tenant. Después de importarlo puedes escanear:

| Código | Resuelve a | Para probar |
|--------|-----------|-------------|
| `7801234567890` | variante *6x40 zincado* | retiro de consumible |
| `17801234567890` | la misma variante | es un empaque: trae 100 por caja |
| `17809876543210` | la misma variante | otro empaque: 250 por caja |
| `EFG-XXXXXXXX` | un ejemplar de taladro | préstamo y devolución |
| `4059952533445` | variante del esmeril | EAN del modelo: pide elegir ejemplar |

Los cuatro primeros códigos apuntan al **mismo pozo de stock**: distinto proveedor y
distinto envase, un solo inventario.

-----|------|-------------|
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
│   │   │   ├── auth.py            # Login, refresh, /me
│   │   │   ├── catalogo.py        # Productos, variantes, unidades, códigos, escaneo
│   │   │   ├── import_catalogo.py # Carga masiva Excel (template + dry_run)
│   │   │   ├── proveedores.py     # Catálogo de proveedores del tenant
│   │   │   ├── loans.py           # Préstamos de ejemplares, kits, devolución
│   │   │   ├── inventory.py       # Bitácora de movimientos
│   │   │   ├── integraciones.py   # /assets/query para agentes externos (n8n)
│   │   │   ├── dashboard.py       # KPIs, quiebres, gasto por obra, valor de bodega
│   │   │   ├── ubicaciones.py     # Posiciones de bodega (rack/nivel/posición)
│   │   │   ├── users.py           # CRUD usuarios del tenant
│   │   │   ├── projects.py        # CRUD proyectos del tenant
│   │   │   ├── catalog.py         # Marcas y estados
│   │   │   ├── menu.py            # Menú dinámico por rol
│   │   │   └── superadmin.py      # Panel global (solo super_admin)
│   │   ├── core/
│   │   │   ├── dependencies.py    # CurrentToken, DBSession, X-Acting-Tenant
│   │   │   ├── security.py        # JWT + bcrypt
│   │   │   └── uid.py             # Genera códigos EFG-XXXXXXXX
│   │   ├── models/                # SQLAlchemy ORM
│   │   ├── repositories/          # BaseRepository con filtro multi-tenant
│   │   ├── schemas/               # Pydantic request/response
│   │   └── services/
│   │       ├── catalogo.py        # Alta, códigos, compra, retiro, ajuste, merma
│   │       └── prestamo.py        # Préstamo, devolución, kits, reparación, pérdida
│   └── alembic/versions/          # 001 … 026
│
└── frontend/
    └── src/
        ├── pages/
        │   ├── Login.tsx
        │   ├── Dashboard.tsx           # KPIs, gasto por obra, valor de bodega
        │   ├── Catalogo.tsx            # Carga Excel + CRUD de catálogo completo
        │   ├── EscanearCatalogo.tsx    # Escaneo y acciones por contexto
        │   ├── Proveedores.tsx
        │   ├── Ubicaciones.tsx
        │   ├── Loans.tsx               # Préstamos activos (bodeguero/admin)
        │   ├── MyLoans.tsx             # Mis préstamos (operario)
        │   ├── Inventory.tsx           # Bitácora de movimientos
        │   ├── Users.tsx  ·  Projects.tsx
        │   └── admin/                  # Tenants, usuarios, estados, menú, permisos
        ├── components/
        │   ├── catalogo/               # Modales: compra, entrega, préstamo,
        │   │                           # devolución, ajuste, merma, reintegro…
        │   ├── scanner/                # CameraScanner, NFCScanner
        │   └── layout/                 # Shell, sidebar colapsable
        ├── hooks/
        │   ├── useMenu.ts              # Menú server-driven por role_id
        │   └── useHIDScanner.ts        # Diferencia lector RFID vs teclado manual
        ├── stores/                     # Zustand: auth, acting tenant
        └── services/api.ts             # Axios + interceptores
```

## Modelo de Datos

```
tenants → users → roles
        → asset_families ─┐
        → brands ─────────┤
                          ↓
                      productos      "Tornillo autoperforante"  · sin stock
                          ↓
                      variantes      "6x40 zincado"  · LA posición de stock
                       ↓      ↓
                 unidades   codigos ← proveedores
                    ↓          (fabricante · proveedor · empaque ·
                  loans         propio · serie_fabrica)
                    ↓
              inventory_logs → projects

modules → menu_items → role_menu_permissions
tenants → subscriptions · api_keys · ubicaciones
```

### Los tres niveles

| Nivel | Responde | Ejemplo |
|-------|----------|---------|
| **Producto** | ¿qué es? | Tornillo autoperforante |
| **Variante** | ¿cuál exactamente? | 6x40 zincado |
| **Unidad** | ¿cuál ejemplar? | el taladro con QR-00417 |

El **producto** agrupa y describe; no tiene stock. La **variante** es el SKU: ahí
viven el stock, el precio, el stock mínimo y los códigos. La **unidad** sólo existe
para familias prestables — es lo que se presta y lo que tiene estado.

### Por qué variantes

Los mismos tornillos llegan de tres proveedores con tres códigos de barras
distintos. Modelarlos como tres activos fragmenta el stock: "tengo 500" pasa a ser
"180 + 220 + 100", cada despacho obliga a elegir de qué pila descontar, y la alerta
de stock mínimo se dispara en falso.

**Un material intercambiable es UNA variante con varios códigos.** El criterio de
corte: *¿el que lo va a usar nota la diferencia?* Un 6x40 y un 8x60 sí — son
variantes separadas. Sodimac y Construmart no — es la misma variante.

### Códigos

Una sola tabla para todo lo escaneable, con `UNIQUE (tenant_id, codigo)`. El **tipo**
decide de qué nivel cuelga:

| Tipo | Responde | Cuelga de |
|------|----------|-----------|
| `fabricante` | ¿qué modelo es? (EAN de fábrica) | variante |
| `proveedor` | ¿con qué número me lo vende éste? | variante |
| `empaque` | ¿cuántas trae esta caja? | variante |
| `serie_fabrica` | ¿cuál ejemplar es? | unidad |
| `propio` | el código que asigné yo | cualquiera |

Un código de `empaque` lleva un **factor**: la caja de un proveedor trae 100 y la
del otro 250. Por eso el contenido vive en el código y no en el producto.

La unicidad es **por tenant**, no global: dos clientes que le compran a la misma
marca comparten el EAN de fábrica y chocarían siempre.

### Stock

- **Consumible** → `variantes.stock_actual`, en la unidad de despacho.
- **Prestable** → NO se almacena: es el conteo de unidades en estado Disponible.
  Guardarlo obligaría a sincronizarlo en cada préstamo, devolución, reparación,
  pérdida y alta — cinco caminos para que mienta sobre datos que tiene al lado.

El stock **nunca se escribe directo**. Se mueve por compra, ajuste, merma, entrega,
pérdida o reintegro, y cada movimiento queda en `inventory_logs` con su costo
congelado. Cambiar un precio no revaloriza el pasado.

### Tipos de movimiento

`compra` · `entrega` · `devolucion` · `ajuste` · `merma` · `perdida` · `reingreso` ·
`reintegro` · `reparacion` · `reparacion_completada`

Se mantienen separados a propósito: si el robo se diluye dentro del consumo, nadie
lo ve — y verlo es el propósito del sistema.

### Kits

Una unidad puede tener unidades hijas (`parent_unidad_id`). Un escaneo del padre
presta el kit completo, y la devolución cierra todas sus piezas. La validación es
previa: si una pieza no está disponible, no se crea **ningún** préstamo.

## API Endpoints Principales

### Autenticación
```
POST /api/v1/auth/login          # { email, password } → { access_token, refresh_token }
POST /api/v1/auth/refresh        # { refresh_token } → nuevos tokens
GET  /api/v1/auth/me             # Usuario autenticado + nombre del tenant
```

### Catálogo
```
GET    /api/v1/productos                    # Lista, filtrable ?comportamiento= ?buscar=
POST   /api/v1/productos                    # Alta: crea producto + variante homónima
PATCH  /api/v1/productos/{id}               # Editar (bloquea cambios que reinterpretan stock)
DELETE /api/v1/productos/{id}
POST   /api/v1/productos/{id}/variantes     # Agregar variante

GET    /api/v1/variantes                    # ?comportamiento= ?producto_id= ?atributo=clave:valor
GET    /api/v1/variantes/low-stock          # Quiebres, consumibles y herramientas
GET    /api/v1/variantes/{id}               # Con códigos y ejemplares
PATCH  /api/v1/variantes/{id}               # No expone stock_actual — se mueve, no se edita
DELETE /api/v1/variantes/{id}

POST   /api/v1/variantes/{id}/unidades      # Alta por cantidad, UID EFG-XXXXXXXX
PATCH  /api/v1/unidades/{id}                # Ubicación y próxima mantención
DELETE /api/v1/unidades/{id}

POST   /api/v1/variantes/{id}/codigos       # Códigos de la variante
POST   /api/v1/unidades/{id}/codigos        # Códigos del ejemplar
PATCH  /api/v1/codigos/{id}/principal       # El que se imprime en la etiqueta
DELETE /api/v1/codigos/{id}                 # Promueve al más antiguo si era principal

GET    /api/v1/scan-catalogo/{codigo}       # Resuelve variante o unidad, e indica cuál
```

### Movimientos de inventario
```
POST /api/v1/variantes/{id}/purchase      # Por cantidad o por empaque (factor del código)
POST /api/v1/variantes/{id}/withdraw      # Entrega a operario, sin crear préstamo
POST /api/v1/variantes/{id}/adjust        # Ajuste a valor absoluto tras conteo físico
POST /api/v1/variantes/{id}/shrinkage     # Merma
POST /api/v1/variantes/{id}/loss          # Pérdida de consumible
POST /api/v1/variantes/{id}/reintegro     # Sobrante que vuelve de una obra
GET  /api/v1/variantes/{id}/despachos-pendientes
GET  /api/v1/variantes/{id}/movimientos   # Bitácora de la variante
```

### Préstamos
```
GET  /api/v1/loans                        # ?active_only=true
POST /api/v1/loans                        # Presta un ejemplar, o el kit completo
POST /api/v1/loans/{id}/return            # Devolución, con send_to_repair opcional
GET  /api/v1/loans/my                     # Préstamos del operario autenticado
GET  /api/v1/loans/active/unidad/{id}     # Préstamo abierto de un ejemplar
GET  /api/v1/loans/disponibles/{var_id}   # Ejemplares que se pueden prestar ahora
GET  /api/v1/loans/kit/{unidad_id}        # Piezas de un kit

POST /api/v1/unidades/{id}/repair-done    # Cierra reparación
POST /api/v1/unidades/{id}/loss           # Reporta robo y cierra su préstamo
POST /api/v1/unidades/{id}/reingreso      # Apareció: descuenta la pérdida de la obra
```

### Proveedores y carga masiva
```
GET/POST/PATCH/DELETE /api/v1/proveedores
GET  /api/v1/proveedores/de-variante/{id}    # Los que esa variante ya conoce

GET  /api/v1/catalogo/import/template        # Excel: precargado o con ejemplos
POST /api/v1/catalogo/import?dry_run=true    # Valida sin escribir
POST /api/v1/catalogo/import?dry_run=false   # Aplica
```

### Dashboard
```
GET /api/v1/dashboard/stats
GET /api/v1/dashboard/assets-by-state
GET /api/v1/dashboard/low-stock-detail
GET /api/v1/dashboard/valor-bodega
GET /api/v1/dashboard/costo-materiales-por-proyecto
GET /api/v1/dashboard/costo-materiales-por-proyecto/{id}/materiales
GET /api/v1/dashboard/overdue-loans
```

### Integraciones (autenticación por `X-API-Key`)
```
GET /api/v1/assets/query?q=<texto>   # Busca por producto, variante o código exacto
```
Contrato completo en [`openspec/notas/contrato-n8n.md`](openspec/notas/contrato-n8n.md).

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

## Escáner RFID / QR

El hook `useHIDScanner` diferencia un lector HID externo del teclado manual midiendo
el tiempo entre keystrokes:

- **< 80 ms entre caracteres** → lector RFID/QR → dispara escaneo automático
- **≥ 80 ms** → escritura manual → no dispara
- **Foco en un `input`** → ignora las pulsaciones, para no robarse lo que se está
  escribiendo (es lo que permite escanear una credencial dentro de un modal)

Además hay lectura por cámara (QR) y por NFC, y un campo manual como respaldo.

### Un gesto, la acción correcta

`GET /scan-catalogo/{codigo}` resuelve **cualquier** código en una sola consulta e
indica si llegó a una variante o a un ejemplar. La interfaz elige la acción con esta
precedencia:

| Lo que resolvió | Acción principal |
|---|---|
| Variante consumible | **Retirar consumible** |
| Unidad En Reparación | **Marcar como reparada** |
| Unidad Robada | no opera — ofrece **reingresar** si apareció |
| Unidad con préstamo abierto | **Registrar devolución**, con quién la tiene |
| Unidad que es kit padre | **Prestar kit completo**, listando sus piezas |
| Resto | **Registrar préstamo** |

Secundarias: reportar pérdida, registrar merma y reintegrar sobrante (esta última
sólo si hay despachos abiertos).

**El escaneo no registra compras.** Escanear es el gesto de despachar, en el mesón
con el operario esperando; ofrecer ahí una acción que suma stock invita a confundir
una entrega con una recepción. La compra vive en Catálogo, donde se recibe
mercadería con la factura a la vista.

### Escanear el modelo vs. el ejemplar

Los tres esmeriles del mismo modelo comparten el EAN de fábrica. Escanearlo resuelve
a la **variante**: "2 de 3 disponibles, elige cuál prestar". Escanear el QR pegado a
una máquina resuelve a **ese** ejemplar. Dos gestos, dos respuestas correctas.

### Credencial del operario

Préstamo, devolución y entrega piden escanear la credencial de quien recibe o
devuelve. En la devolución, si no coincide con quien retiró, **se permite igual y
queda registrado**: en una obra el titular se enfermó o está en otro frente, y
bloquearlo deja al bodeguero con la herramienta en la mano y un préstamo que no
puede cerrar. La responsabilidad no se mueve.

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

## Carga del Catálogo

La carga masiva por Excel es para **el arranque**; de ahí en adelante el catálogo se
mantiene desde la interfaz.

**Catálogo → Descargar template** entrega un `.xlsx` con una fila por variante. Si el
tenant no tiene catálogo, trae filas de ejemplo con sus familias reales.

| Columna | Notas |
|---------|-------|
| `producto` | Repetirlo agrupa: dos filas con el mismo producto y distinta variante crean UN producto con dos variantes |
| `variante` | Vacía → variante homónima del producto |
| `familia` | Debe existir en el tenant; define prestable o consumible |
| `codigos` | `codigo[:tipo[:factor[:proveedor]]]`, separados por `;`. El proveedor se crea por nombre si no existe |
| `cantidad_unidades` | Sólo prestables: crea N ejemplares con UID autogenerado |
| `ubicacion` | `RACK/NIVEL/POSICION`, se crea si no existe |

**Reimportar es seguro.** El template se descarga con `stock_actual` y
`cantidad_unidades` **vacías**: editar nombres o precios y volver a subirlo no toca
el inventario ni duplica ejemplares. Una celda vacía nunca borra.

Cuando `stock_actual` sí trae valor, **no se escribe directo**: se traduce en un log
de apertura al crear la variante, o en un `ajuste` con su observación al actualizar.

Valida siempre con **Validar** antes de **Confirmar carga**: el reporte muestra qué
se creará, qué ajustes de stock se aplicarían, advertencias y errores por fila, sin
escribir nada.

Ejemplo completo en [`openspec/notas/ejemplo-template-carga.csv`](openspec/notas/ejemplo-template-carga.csv)
y el recorrido paso a paso en [`openspec/notas/flujo-variantes-y-unidades.md`](openspec/notas/flujo-variantes-y-unidades.md).

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
