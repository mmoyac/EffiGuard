# AGENTS.md - Sistema EffiGuard (SaaS Multi-tenant)

## 1. Perfil del Agente
Actúa como un Ingeniero de Software Fullstack Senior y Arquitecto Cloud. Tu objetivo es construir el núcleo de **EffiAssets**, un sistema SaaS de gestión de activos, control de bodega y prevención de robos, diseñado para ser escalable, seguro y altamente parametrizado.

## 2. Stack Tecnológico Obligatorio
- **Backend:** FastAPI (Python 3.11+), SQLAlchemy 2.0 (Async), Alembic para migraciones, PostgreSQL.
- **Frontend:** React + Vite + TypeScript, Tailwind CSS, Lucide React (iconos), React Query.
- **Infraestructura:** Docker y Docker Compose para orquestar Backend, Frontend y Base de Datos.
- **PWA:** Configuración de manifiesto y service workers para instalación en dispositivos móviles.

## 3. Modelo de Datos (DBML)
Esquema vigente, con integridad referencial y multi-tenancy en toda consulta:

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
Table asset_states { id integer [primary key], nombre varchar } // Disponible, En Terreno, Reparación, Robado
Table asset_families { id integer [primary key], tenant_id integer [ref: > tenants.id], nombre varchar, comportamiento varchar, color varchar, dias_max_prestamo integer [null] }
Table projects { id integer [primary key], tenant_id integer [ref: > tenants.id], nombre varchar, is_active boolean }
Table proveedores { id integer [primary key], tenant_id integer [ref: > tenants.id], nombre varchar, rut varchar [null], contacto varchar [null] }
Table ubicaciones { id integer [primary key], tenant_id integer [ref: > tenants.id], rack varchar, nivel varchar, posicion varchar }

// MÓDULO 4: CATÁLOGO (producto -> variante -> unidad)
// El producto agrupa y no tiene stock; la variante ES la posición de stock;
// la unidad es el ejemplar físico y sólo existe en familias prestables.
Table productos {
  id integer [primary key]
  tenant_id integer [ref: > tenants.id]
  family_id integer [ref: > asset_families.id] // define prestable vs consumible
  brand_id integer [null, ref: > brands.id]
  nombre varchar
  descripcion text [null]
  // unique (tenant_id, nombre)
}

Table variantes {
  id integer [primary key]
  tenant_id integer [ref: > tenants.id]
  producto_id integer [ref: > productos.id]
  nombre varchar              // "6x40 zincado"
  atributos jsonb             // {"medida":"6x40","material":"zincado"} - indice GIN
  unidad varchar              // unidad | metro | kilo | litro
  stock_actual decimal(12,3)  // SOLO consumibles; en prestables se deriva del conteo
  stock_minimo decimal(12,3)  // 0 desactiva la alerta de quiebre
  precio_compra decimal(12,2) [null]
  valor_reposicion decimal(12,2) [null]
  dias_max_prestamo integer [null] // si es nulo hereda de la familia
  ubicacion_id integer [null, ref: > ubicaciones.id]
  // unique (producto_id, nombre)
}

Table unidades {
  id integer [primary key]
  tenant_id integer [ref: > tenants.id]
  variante_id integer [ref: > variantes.id]
  estado_id integer [ref: > asset_states.id]
  ubicacion_id integer [null, ref: > ubicaciones.id] // gana sobre la de la variante
  parent_unidad_id integer [null, ref: > unidades.id] // kits padre-hijo
  proxima_mantencion date [null]
}

// Todo lo escaneable en una sola tabla: un ejemplar puede tener su QR y su numero
// de serie, y una variante los codigos de cada proveedor mas los de sus empaques.
Table codigos {
  id integer [primary key]
  tenant_id integer [ref: > tenants.id]
  variante_id integer [null, ref: > variantes.id]
  unidad_id integer [null, ref: > unidades.id]  // CHECK: exactamente uno de los dos
  codigo varchar        // unique (tenant_id, codigo) - por tenant, no global
  tipo varchar          // fabricante | proveedor | empaque | propio | serie_fabrica
  proveedor_id integer [null, ref: > proveedores.id]
  factor decimal(12,3)  // cuantas unidades trae este empaque. CHECK > 0
  nombre_empaque varchar [null] // caja, rollo, tambor...
  es_principal boolean  // el que se imprime en la etiqueta. Unico parcial por dueno
}

// MÓDULO 5: OPERACIONES Y AUDITORÍA
Table loans {
  id integer [primary key]
  tenant_id integer [ref: > tenants.id]
  unidad_id integer [ref: > unidades.id] // se presta un EJEMPLAR, no un modelo
  user_id integer [ref: > users.id] // Operario que recibe y responde
  bodeguero_id integer [ref: > users.id] // Quien entrega
  project_id integer [null, ref: > projects.id]
  fecha_entrega timestamp [default: `now()`]
  fecha_devolucion_prevista timestamp
  fecha_devolucion_real timestamp [null]
}

Table inventory_logs {
  id integer [primary key]
  tenant_id integer [ref: > tenants.id]
  variante_id integer [ref: > variantes.id]  // toda posicion de stock es una variante
  unidad_id integer [null, ref: > unidades.id] // solo si identifica un ejemplar
  codigo_id integer [null, ref: > codigos.id]  // el escaneado en una compra
  proveedor_id integer [null, ref: > proveedores.id] // deducido del codigo
  user_id integer [ref: > users.id] // Ejecutor de la accion
  operario_id integer [null, ref: > users.id] // Quien recibe o responde
  project_id integer [null, ref: > projects.id]
  origen_log_id integer [null, ref: > inventory_logs.id] // reintegro y reingreso
  tipo_movimiento varchar // compra, entrega, devolucion, ajuste, merma, perdida,
                          // reingreso, reintegro, reparacion, reparacion_completada
  cantidad decimal(12,3)
  costo_unitario decimal(12,4) [null] // congelado al ocurrir. Null = sin valorizar
  fecha_hora timestamp [default: `now()`]
  observaciones text
}

Table api_keys {
  id integer [primary key]
  tenant_id integer [ref: > tenants.id]
  key varchar [unique] // prefijo efg_ + 56 hex
  description varchar
  is_active boolean [default: true]
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

Un material, un pozo de stock: Un mismo consumible comprado a varios proveedores es UNA variante con varios códigos, no varias variantes. Partir el stock por proveedor rompe la alerta de mínimo y obliga al bodeguero a elegir de qué pila descontar. Criterio de corte: ¿el que lo va a usar nota la diferencia?

El stock nunca se escribe directo: se mueve por compra, entrega, ajuste, merma, pérdida o reintegro, y cada movimiento queda en inventory_logs con su costo congelado. Ningún formulario debe exponer stock_actual como campo editable.

Stock derivado en prestables: El stock de una variante prestable es el conteo de sus unidades Disponibles, NO una columna. Guardarlo obligaría a sincronizarlo en cinco flujos distintos.

Flujo de Consumibles: Al retirar consumibles el sistema solicita cantidad, descuenta de variantes.stock_actual y genera un log tipo entrega sin crear registro en loans — un tornillo no se devuelve. Lo que sobra vuelve por reintegro contra su despacho de origen.

Gestión de Kits: Si una unidad tiene unidades hijas, un escaneo del padre presta el conjunto completo. La disponibilidad se valida ANTES de crear ningún préstamo: entregar media caja y descubrirlo a mitad de camino deja registros que no se pueden deshacer.

Movimientos separados: consumo, merma y pérdida no se consolidan. Si el robo se diluye dentro del consumo nadie lo ve, y verlo es el propósito del sistema.

Carga masiva vs. interfaz: El Excel es para el arranque; el día a día se opera desde la UI, que debe cubrir el ciclo completo por su cuenta.

Navegación Dinámica: El menú lateral de React no debe estar hardcodeado. Debe construirse consumiendo el endpoint que retorna los menu_items permitidos para el role_id del usuario autenticado.

## 5. Requerimientos Técnicos de Salida
Generar la estructura de carpetas backend/ y frontend/.

Configurar la autenticación JWT devolviendo tenant_id y role_id en el payload.

Crear el Middleware o Dependencia en FastAPI para inyectar el filtro de Tenant en cada consulta.

Implementar las migraciones iniciales de base de datos con Alembic.

Crear el docker-compose.yml para orquestar todos los servicios.