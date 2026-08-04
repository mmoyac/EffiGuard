# Contrato de `/assets/query` para n8n

El endpoint que consulta el agente **cambió de forma** al migrar al catálogo
producto → variante → unidad. La ruta y la autenticación son las mismas; lo que
cambió son los campos de la respuesta.

Reconfigurar el workflow se hace en n8n, no en este repositorio. Esta nota existe
para tener el contrato a mano al abrirlo.

## Lo que NO cambió

```
GET  {BASE}/api/v1/assets/query?q=<texto>
Header: X-API-Key: efg_...
```

- Sin la cabecera → `401 X-API-Key requerido`
- Key inválida o revocada → `401 API key inválida o revocada`
- La key resuelve el tenant: cada cliente ve sólo lo suyo.

## Lo que cambió

| Antes (catálogo de activos) | Ahora (producto → variante → unidad) |
|---|---|
| `nombre` | `producto` + `variante` |
| `estado` (Disponible / En Terreno…) | `unidades_total`, `unidades_disponibles` |
| `operario`, `fecha_prestamo` | `prestadas_a[]` — una línea por ejemplar prestado |
| `stock_actual`, `stock_minimo`, `bajo_stock` | igual |
| `ubicacion_rack/nivel/posicion` | igual |

El cambio de fondo: **un activo era una cosa; una variante puede tener varios
ejemplares**. Por eso el estado único se reemplazó por conteos, y el operario
único por una lista.

## Respuesta

Siempre una lista, hasta 25 resultados. Todos los campos van siempre presentes;
los que no aplican al comportamiento vienen en cero o vacíos.

### Herramienta (`tipo: "prestable"`)

```json
[
  {
    "producto": "Esmeril angular GWS-850",
    "variante": "Esmeril angular GWS-850",
    "tipo": "prestable",
    "unidad": "unidad",
    "unidades_total": 2,
    "unidades_disponibles": 1,
    "prestadas_a": ["Juan Chañafil desde 03/08/2026 23:58"],
    "stock_actual": 0.0,
    "stock_minimo": 0.0,
    "bajo_stock": false,
    "ubicacion_rack": "RACK-C",
    "ubicacion_nivel": "N1",
    "ubicacion_posicion": "P2"
  }
]
```

`prestadas_a` lista sólo unidades raíz: al prestar un kit se crea un préstamo por
pieza, y listarlas todas repetiría al mismo operario N veces por una sola entrega.

### Consumible (`tipo: "consumible"`)

```json
[
  {
    "producto": "Tornillo autoperforante",
    "variante": "6x40 zincado",
    "tipo": "consumible",
    "unidad": "unidad",
    "unidades_total": 0,
    "unidades_disponibles": 0,
    "prestadas_a": [],
    "stock_actual": 401.0,
    "stock_minimo": 200.0,
    "bajo_stock": false,
    "ubicacion_rack": "RACK-A",
    "ubicacion_nivel": "N2",
    "ubicacion_posicion": "P3"
  }
]
```

## Qué busca `q`

Tres cosas a la vez, con un solo parámetro:

1. **Nombre del producto** — `q=Tornillo` devuelve sus variantes, cada una con su
   propia disponibilidad.
2. **Nombre de la variante** — `q=6x40` acota a esa.
3. **Código exacto** — `q=7801234567890` resuelve por número de parte del
   proveedor, EAN de fábrica o código interno.

Lo tercero es nuevo y vale la pena aprovecharlo: permite que el agente responda
cuando alguien pega un número de la factura en vez del nombre.

## Cómo redactar la respuesta del agente

Un mismo producto puede volver con varias variantes. Conviene agrupar por
`producto` y detallar por `variante`, porque la diferencia importa: quedan 200
tornillos 6x40 y ninguno 8x60 no es lo mismo que "quedan 200 tornillos".

Para herramientas, `unidades_disponibles` es lo accionable —cuántas puede pedir
ahora— y `prestadas_a` explica por qué el resto no está.

`bajo_stock` ya viene calculado contra el mínimo configurado: el agente no debe
comparar por su cuenta, porque la regla incluye que un mínimo en cero desactiva la
alerta.

## Verificación rápida

```bash
curl -s -H "X-API-Key: efg_..." \
  "http://localhost:8000/api/v1/assets/query?q=Esmeril"
```

Las API keys se administran desde Administración → Tenants → API Keys. El valor
completo sólo se muestra al crearla.
