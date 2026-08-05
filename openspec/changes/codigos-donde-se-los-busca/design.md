## Context

La sección de códigos vive hoy dentro del panel desplegable de la variante, en [Catalogo.tsx:512-533](../../../frontend/src/pages/Catalogo.tsx), inmediatamente **debajo** del botón "Editar variante". Están a diez píxeles uno del otro, y aun así el usuario que quería cambiar un EAN13 no la encontró: abrió el modal, no vio códigos, y concluyó que no se podía.

Las piezas que ya existen y funcionan:

- `ChipCodigo` ([Catalogo.tsx:57](../../../frontend/src/pages/Catalogo.tsx)) — el chip con sus acciones de principal y eliminar
- `ModalCodigo` ([Catalogo.tsx:267](../../../frontend/src/pages/Catalogo.tsx)) — el formulario de alta, con creación de proveedor al vuelo
- Los cuatro endpoints de códigos, incluido el 409 con "ya está registrado en otro item"
- `CameraScanner`, que ya decodifica EAN13 sin configuración extra porque no restringe `formatsToSupport`

Nada de esto hay que construirlo. Lo que falta es exponerlo.

## Goals / Non-Goals

**Goals:**

- Que los códigos se encuentren desde "Editar variante", que es donde el usuario los busca.
- Que un código nuevo se pueda dar de alta desde el mesón, sin abandonar el escaneo.
- Que el formulario no ofrezca datos que contradicen el tipo elegido.
- Que el EAN13 por cámara sea usable, y que quede escrito que la cámara debe leerlo.

**Non-Goals:**

- Editar un código en sitio. Un código es un identificador físico impreso: editarlo cambia en silencio a qué apunta una etiqueta ya pegada en bodega. El reemplazo explícito —agregar, marcar principal, borrar— es la conducta correcta.
- Limpiar los dos códigos `fabricante` con proveedor que quedaron en el demo. Se corrigen desde la interfaz.
- Tocar el backend. Los endpoints cubren todo lo necesario.
- Unificar el alta de código de variante con la de unidad en un solo componente. Comparten forma pero no tipos válidos, y forzar la abstracción ahora acopla dos cosas que divergen.

## Decisions

### 1. Extraer la sección de códigos a un componente, no duplicarla

`SeccionCodigos` recibe la variante y renderiza el encabezado, los chips y el botón de agregar. La montan el panel y el modal de edición.

Duplicar el bloque en el modal era lo más rápido y es exactamente el error que acabamos de pagar caro en otro frente: la captura de credencial estaba copiada en siete lugares, divergió, y un refactor la borró de tres sin que nada avisara. Un solo componente montado en dos lugares no tiene ese problema.

Se descartó **mover** la sección al modal y sacarla del panel. Ver los códigos de un vistazo al desplegar la variante es útil por sí solo —el bodeguero mira qué códigos tiene sin intención de editarlos— y quitarlo para arreglar el acceso cambiaría un problema por otro.

### 2. El modal de alta de código se reutiliza tal cual desde el escáner

`ModalCodigo` ya resuelve el alta completa: tipo, factor, envase, proveedor y creación de proveedor al vuelo. Desde el escáner se abre el mismo, con el código escaneado precargado y bloqueado —el usuario ya lo escaneó, retipearlo sólo introduce errores— y con un paso previo para elegir a qué variante asociarlo.

Se descartó un formulario propio para el escáner: sería una segunda implementación del mismo alta, divergiendo desde el día uno.

`ModalCodigo` vive hoy dentro de `Catalogo.tsx`. Se muda a `components/catalogo/` para que el escáner lo importe sin que una página dependa de otra — el mismo criterio que `shared.tsx` ya documenta.

### 3. La búsqueda de variante en el escáner reusa el buscador que existe

El escáner necesita "¿a qué variante le asocio este código?". El catálogo ya tiene búsqueda por nombre de producto o variante. Se reusa esa consulta, no una nueva.

### 4. El proveedor se limpia al cambiar de tipo, no sólo se oculta

Ocultar el campo dejando el valor en el estado enviaría un `proveedor_id` que el usuario ya no ve — el dato invisible que después nadie explica. Al cambiar a un tipo que no admite proveedor, el valor se descarta.

Es el mismo tratamiento que ya reciben `factor` y `nombre_empaque`, que sólo se envían cuando el tipo es `empaque`.

### 5. `qrbox` como función del viewport, no constante

`html5-qrcode` acepta una función `(viewfinderWidth, viewfinderHeight) => ({width, height})`. Se calcula una ventana ancha —del orden del 80 % del ancho disponible— y baja, con tope para no desbordar en pantallas grandes.

Se descartó subir el cuadrado a 300×300: mejora el encuadre del EAN13 pero sigue exigiendo alejar el dispositivo, porque el problema es la proporción y no el tamaño.

No se toca `formatsToSupport`. Dejarlo sin declarar es lo que hoy habilita todos los formatos; declararlo explícitamente sería fijar una lista que hay que mantener. Lo que sí queda es el requisito de spec que prohíbe restringirlo a QR.

## Risks / Trade-offs

**La sección de códigos aparece en dos lugares y puede confundir** → Es el mismo componente con el mismo estado del servidor: agregar en uno se refleja en el otro al invalidar `productos`. No hay dos fuentes de verdad, sólo dos accesos.

**El modal de edición se alarga** → Ya tiene scroll (`max-h-[90vh] overflow-y-auto` en `Modal`). Los códigos van al final, después de los campos que se editan más seguido.

**El alta desde el escáner agrega pasos en el mesón** → Sólo aparece cuando el escaneo no resuelve, que hoy es un callejón sin salida. Cualquier cosa es mejor que "Código no encontrado" y limpiar.

**Cambiar `qrbox` podría empeorar el QR** → Una ventana más ancha contiene al cuadrado que hay hoy, así que el QR tiene al menos la misma superficie. Se verifica escaneando ambos en el mismo dispositivo antes de dar el punto por cerrado.

**Mudar `ModalCodigo` de archivo toca `Catalogo.tsx`, que es grande** → Es un movimiento de código sin cambio de comportamiento, y el `npm run build` con `noUnusedLocals` detecta cualquier import que quede colgando.

## Open Questions

Ninguna bloqueante. Queda anotado que si aparece la necesidad de corregir un dedazo en un código sin borrar y recrear, corresponde discutir la edición en sitio como cambio propio, con el argumento de la etiqueta ya impresa sobre la mesa.
