# AGENTS.md - Sistema EffiGuard (SaaS Multi-tenant)

## 1. Perfil del Agente
Actúa como un Ingeniero de Software Fullstack Senior y Arquitecto Cloud. Tu objetivo es construir el núcleo de **EffiAssets**, un sistema SaaS de gestión de activos, control de bodega y prevención de robos, diseñado para ser escalable, seguro y altamente parametrizado.

## 2. Stack Tecnológico Obligatorio
- **Backend:** FastAPI (Python 3.11+), SQLAlchemy 2.0 (Async), Alembic para migraciones, PostgreSQL.
- **Frontend:** React + Vite + TypeScript, Tailwind CSS, Lucide React (iconos), React Query.
- **Infraestructura:** Docker y Docker Compose para orquestar Backend, Frontend y Base de Datos.
- **PWA:** Configuración de manifiesto y service workers para instalación en dispositivos móviles.

## 3. Modelo de Datos (DBML - 14 Tablas Normalizadas)
Implementar el siguiente esquema asegurando integridad referencial y multi-tenancy:

```dbml
// MÓDULO 0: MULTI-TENANT & CONTROL GLOBAL
Table tenants {
  id integer [primary key]
  nombre_empresa varchar
  rut_empresa varchar [unique]
  slug varchar [unique]
  is_active boolean [default: true]
  plan_type varchar // basic, pro, enterprise
  created_at timestamp [default: `now()`]
}

// MÓDULO 1: SEGURIDAD (RBAC)
Table roles {
  id integer [primary key]
  nombre varchar [unique] // super_admin, admin, bodeguero, operario
  descripcion text
}

Table users {
  id integer [primary key]
  tenant_id integer [ref: > tenants.id]
  role_id integer [ref: > roles.id]
  rut varchar
  nombre varchar
  email varchar
  password_hash varchar
  uid_credencial varchar [unique] // ID de Tag RFID/NFC o QR de empleado
  is_active boolean [default: true]
}

// MÓDULO 2: NAVEGACIÓN DINÁMICA (SERVER-DRIVEN UI)
Table modules {
  id integer [primary key]
  nombre varchar
  icono varchar
  orden integer
}

Table menu_items {
  id integer [primary key]
  module_id integer [ref: > modules.id]
  parent_id integer [null, ref: > menu_items.id]
  label varchar
  ruta varchar
  icono varchar
  orden integer
}

Table role_menu_permissions {
  id integer [primary key]
  role_id integer [ref: > roles.id]
  menu_item_id integer [ref: > menu_items.id]
}

// MÓDULO 3: MAESTROS Y CATÁLOGO
Table brands { id integer [primary key], tenant_id integer [ref: > tenants.id], nombre varchar }
Table models { id integer [primary key], tenant_id integer [ref: > tenants.id], brand_id integer [ref: > brands.id], nombre varchar }
Table asset_states { id integer [primary key], nombre varchar } // Disponible, En Terreno, Reparación, Robado
Table projects { id integer [primary key], tenant_id integer [ref: > tenants.id], nombre varchar, is_active boolean }

// MÓDULO 4: ACTIVOS E INVENTARIO (Híbrido Herramientas/Consumibles)
Table assets {
  id integer [primary key]
  tenant_id integer [ref: > tenants.id]
  uid_fisico varchar [unique] // Código QR o Tag RFID
  parent_asset_id integer [null, ref: > assets.id] // Lógica para Kits (Padre-Hijo)
  model_id integer [ref: > models.id]
  tipo varchar // 'herramienta' (requiere préstamo) o 'consumible' (solo stock)
  estado_id integer [ref: > asset_states.id]
  stock_actual integer [default: 0]
  stock_minimo integer [default: 0]
  valor_reposicion decimal(12,2)
  proxima_mantencion date
  created_at timestamp [default: `now()`]
}

// MÓDULO 5: OPERACIONES Y AUDITORÍA
Table loans {
  id integer [primary key]
  tenant_id integer [ref: > tenants.id]
  asset_id integer [ref: > assets.id]
  user_id integer [ref: > users.id] // Operario que recibe
  bodeguero_id integer [ref: > users.id] // Quien entrega
  project_id integer [null, ref: > projects.id]
  fecha_entrega timestamp [default: `now()`]
  fecha_devolucion_prevista timestamp
}

Table inventory_logs {
  id integer [primary key]
  tenant_id integer [ref: > tenants.id]
  asset_id integer [ref: > assets.id]
  user_id integer [ref: > users.id] // Ejecutor de la acción
  tipo_movimiento varchar // entrega, devolucion, ajuste, compra, perdida
  cantidad integer [default: 1]
  fecha_hora timestamp [default: `now()`]
  observaciones text
}

Table subscriptions {
  id integer [primary key]
  tenant_id integer [ref: > tenants.id]
  fecha_inicio date
  fecha_fin date
  estado_pago varchar // active, past_due, trialing
}

## 4. Reglas de Negocio y Lógica Operativa
Aislamiento Multi-tenant: El tenant_id debe ser filtrado automáticamente en la capa de persistencia (BaseRepository) mediante inyección de dependencias en FastAPI. Ningún usuario puede acceder a datos de otro tenant_id.

UX/UI Industrial:
- Botones táctiles de gran tamaño (mínimo 48px).
- Modo oscuro por defecto (ahorro de batería y legibilidad en fábrica).
- Soporte para entrada de teclado HID (lectores RFID/QR externos emulando teclado).
- **Sin scroll horizontal en ninguna vista.** Toda pantalla debe caber en el ancho del dispositivo. Usar `w-full`, `min-w-0`, `overflow-hidden`, `truncate` y layouts flexibles. Nunca usar anchos fijos que superen el viewport.
- **Mobile-first obligatorio.** La app debe funcionar perfectamente en smartphones y tablets industriales. Diseñar primero para pantallas pequeñas (≥320px) y escalar hacia arriba. Usar clases responsive de Tailwind (`sm:`, `md:`) para adaptar layouts, nunca al revés.
- Las tablas deben reemplazarse por cards en móvil o usar `overflow-x-auto` únicamente como último recurso, nunca como solución por defecto.

Flujo de Consumibles: Al retirar consumibles (pernos, discos), el sistema solicita cantidad, descuenta de assets.stock_actual y genera un log en inventory_logs sin crear un registro en loans.

Gestión de Kits: Si un activo tiene parent_asset_id nulo pero posee "hijos" vinculados, el sistema debe permitir realizar el préstamo del conjunto completo (Kit) con un solo escaneo del código del padre.

Navegación Dinámica: El menú lateral de React no debe estar hardcodeado. Debe construirse consumiendo el endpoint que retorna los menu_items permitidos para el role_id del usuario autenticado.

## 5. Requerimientos Técnicos de Salida
Generar la estructura de carpetas backend/ y frontend/.

Configurar la autenticación JWT devolviendo tenant_id y role_id en el payload.

Crear el Middleware o Dependencia en FastAPI para inyectar el filtro de Tenant en cada consulta.

Implementar las migraciones iniciales de base de datos con Alembic.

Crear el docker-compose.yml para orquestar todos los servicios.