## Context

El dato que el operario necesita ya existe y está bien modelado: `variantes.stock_actual` para consumibles, el conteo de unidades en estado Disponible para prestables, y `ubicaciones` con la precedencia unidad → variante ya especificada en `productos-y-variantes`. Lo que falta no es información sino **una puerta**: hoy sólo se llega a ese dato por las pantallas de mantención de catálogo, que exponen precios de compra y botones que mueven stock.

El rol operario, además, nunca tuvo spec. Su menú se definía por remisión al seed (`002_seeds.py`), y la migración `024` lo modificó sin que nada lo advirtiera. Este cambio cierra las dos cosas a la vez porque son la misma: definir qué alcanza el operario es la condición para poder agregarle algo sin volver a romperlo.

Restricciones que condicionan el diseño:

- El proyecto **aún no está en producción con usuarios reales**, así que retirar un permiso de rol no requiere plan de convivencia.
- La pantalla se usa caminando, con guantes, en un teléfono. Un resultado que exige dos toques para revelar la ubicación no sirve.
- `BaseRepository` inyecta `tenant_id` en toda query; nada de lo que sigue puede saltárselo.

## Goals / Non-Goals

**Goals:**

- Responder "¿hay, y dónde está?" en una pantalla, sin intermediarios y sin exponer costos.
- Fijar en la spec el alcance completo del rol operario, para que el próximo cambio de menú no se lo amplíe por accidente.
- Cero tablas nuevas, cero cambios en el flujo de despacho.

**Non-Goals:**

- No hay reserva, apartado ni lista de pedido. El operario mira; el bodeguero despacha. Si más adelante la lista de pedido demuestra hacer falta, entra como cambio propio y con su propia tabla.
- No se toca el escaneo de despacho ni sus reglas: sólo se retira el permiso del rol operario sobre él.
- No se rediseña el sistema de permisos. Sigue siendo `role_menu_permissions`, server-driven.

## Decisions

### Endpoint propio en vez de reutilizar `GET /api/v1/variantes`

`GET /api/v1/bodega/buscar` es un router nuevo, no un parámetro del listado de catálogo.

`VarianteResponse` incluye `precio_compra` y `valor_reposicion`. Reutilizarlo obligaría a filtrar campos según el rol de quien pregunta —"si `role_id == 4`, no mandes el precio"—, que es la clase de condicional que se olvida la próxima vez que alguien agrega un campo a la respuesta. Un schema separado que **no tiene** el campo no puede filtrarlo mal.

Alternativa descartada: `GET /variantes?vista=operario`. Un filtro que hay que acordarse de pasar es una fuga esperando su turno; además la forma de la respuesta es distinta (ubicaciones por unidad disponible, disponibilidad ya expresada en los términos del item), no un subconjunto.

El endpoint queda abierto a **cualquier rol autenticado del tenant**, no sólo al operario. Es sólo lectura y sin costos: no hay razón para que el bodeguero, que también busca cosas, tenga que entrar al mantenedor para responderse lo mismo.

### La disponibilidad se resuelve en el backend, no en la tarjeta

La respuesta trae `disponibilidad_texto` ya armado ("240 un", "3 de 7 disponibles") además de los números crudos. La regla de qué significa "disponible" depende del `comportamiento` de la familia, que es dominio; dejarla en el componente React la duplicaría en cada pantalla que después quiera mostrar lo mismo, y la primera divergencia sería silenciosa.

### Ubicación: una query agregada, no N+1

Para consumibles la ubicación es la de la variante y viene en el `join` que ya hace `VarianteRepository`. Para prestables hay que listar las ubicaciones de las unidades **disponibles**, que son varias. Se resuelve con una segunda query agregada sobre las variantes prestables del resultado (`unidades` join `ubicaciones` where `estado_id = 1 and variante_id in (...)`), agrupando por ubicación y contando ejemplares. Una consulta por página de resultados, no una por fila.

Las ubicaciones se deduplican y se ordenan por rack, nivel y posición. Cuando el resultado es "sin ubicación asignada" se envía explícito, no como `null` omitido: la pantalla lo muestra para que la falta de dato se note y alguien la cargue.

### Búsqueda: nombre por `ilike`, código por igualdad exacta

`VarianteRepository.listar` ya busca en `producto.nombre` y `variante.nombre` con `ilike`. Se agrega un método `buscar_para_bodega` que hace lo mismo más un `OR` sobre `codigos.codigo == texto` —igualdad, no `like`—, y ordena los aciertos por código primero.

El código se compara exacto a propósito. Un `%12%` sobre la tabla de códigos devuelve medio catálogo y entierra el acierto real; y el caso de uso es el operario tipeando o escaneando lo impreso en la caja, que es el código completo o nada.

Mínimo de 2 caracteres (422 bajo ese umbral) y límite de 50 resultados: la pantalla es para encontrar algo puntual, no para pasear el catálogo.

### El corte de rutas en el cliente es una lista explícita, no derivada del menú

Sería tentador derivar los permisos de ruta del `GET /menu`, que ya viene filtrado por rol. Se descarta: existen rutas que no están en el menú (`/catalogo/scan` como sub-ruta, las pantallas de administración) y, sobre todo, convertiría la pantalla "Administración → Permisos" en una superficie de autorización real —un admin editando el menú abriría o cerraría rutas de la app sin saberlo—.

El guardado queda como un `RoleRoute` con la lista de roles permitidos por ruta, en el mismo `App.tsx` donde se declaran. El menú sigue mandando en **qué se ve**; la lista manda en **a qué se entra**. Que ambas cosas puedan divergir es aceptable y preferible a que un cambio de navegación mueva un límite de seguridad.

El corte del cliente es de usabilidad, no de seguridad: el backend sigue siendo la autoridad. Lo que evita es la pantalla que se abre vacía y rota y hace pensar al operario que la aplicación falla.

### El menú se mueve por migración, no por seed

Migración `028`: alta de los `menu_items` "Mis Préstamos" (`/my-loans`, módulo Préstamos) y "Bodega" (`/bodega`, módulo Inventario), permisos del operario sobre ambos, y baja de su permiso sobre "Escanear". El seed `002` no se toca — ya corrió en todos los ambientes y editarlo no cambiaría ninguna base existente.

"Bodega" se otorga también a `bodeguero` y `admin`: la misma consulta le sirve a quien atiende el mesón.

## Risks / Trade-offs

**El catálogo tiene poca ubicación cargada** → la consulta va a responder "sin ubicación asignada" en buena parte del catálogo y el operario va a concluir que la pantalla no sirve. Mitigación: mostrarlo explícito en vez de esconder el campo, para que la falta se vea y se cargue. No se bloquea ni se oculta el resultado: saber que hay, aunque no dónde, ya ahorra el viaje al mesón.

**El stock del sistema puede no coincidir con el rack** → el operario llega confiado, no hay, y culpa al sistema. Mitigación: ninguna técnica; es el problema que resuelven los ajustes de inventario. La consulta muestra existencias del sistema y el bodeguero sigue siendo quien confirma. Vale la pena notar que esta pantalla, al ser consultada muchas veces al día, va a **exponer** las diferencias de stock antes que cualquier toma de inventario.

**Retirarle el escáner al operario podría chocar con una bodega donde hoy se autoatiende** → Mitigación: es reversible desde Administración → Permisos sin desplegar ni migrar, y el proyecto todavía no tiene usuarios reales.

**Un guardado de rutas en el cliente que se olvide al agregar una pantalla** → la ruta nueva queda abierta al operario. Mitigación: `RoleRoute` se declara junto a la ruta en `App.tsx`, no en un archivo aparte; el olvido es visible en el diff.

## Migration Plan

1. Migración `028_menu_bodega_operario.py`, con `downgrade` que restituye exactamente el estado previo (incluido el permiso del operario sobre "Escanear").
2. Backend y frontend se despliegan juntos: la pantalla `/bodega` sin su endpoint no sirve, y el ítem de menú apuntaría a una ruta muerta.
3. Rollback: `alembic downgrade -1` devuelve el menú anterior. El endpoint puede quedar publicado sin daño —es de sólo lectura— si hiciera falta revertir sólo el frontend.

## Open Questions

Ninguna bloqueante. Queda anotado para más adelante, no para este cambio: si la consulta se usa mucho, el paso siguiente natural es que el operario arme una lista de lo que va a pedir y el bodeguero la abra en su pantalla cuando lo vea llegar.
