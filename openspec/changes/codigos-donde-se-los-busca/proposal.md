## Why

Un usuario quiso cambiar el EAN13 de un consumible. Abrió **Editar variante**, que es el botón que dice editar la variante, y no encontró los códigos: viven en una sección aparte del panel desplegable, justo encima de ese botón. Tuvo que preguntar dónde estaban.

Ese episodio destapó cuatro problemas del mismo tipo. La gestión de códigos está construida y funciona; lo que falla es que no está donde se la busca, y donde está no guía bien:

1. **Los códigos no son alcanzables desde "Editar variante".** El modal maneja nombre, unidad, stock mínimo y precio. Los códigos quedan fuera, en el panel, y el nombre del botón promete lo contrario.
2. **El escáner no ofrece dar de alta un código que no resuelve.** El requisito `escaneo → Alta de código desde un escaneo sin resultado` lo exige desde hace tiempo; la interfaz sólo muestra "Código no encontrado" durante 4 segundos y limpia. Cuando llega un lote con un código nuevo, el bodeguero tiene que abandonar el mesón e ir al mantenedor — exactamente la interrupción que ese requisito quería evitar.
3. **El campo *Proveedor* se ofrece en tipos donde contradice su propio texto.** Al elegir *EAN de fábrica* el formulario explica "El que viene impreso, igual para todos los proveedores" y acto seguido pide un proveedor. El usuario eligió Sodimac, como era de esperar, y quedaron dos códigos `fabricante` con proveedor: un dato que afirma que ese EAN es de un proveedor cuando por definición es de todos.
4. **La cámara lee EAN13 con una ventana cuadrada.** `qrbox` es 200×200, la forma de un QR. Un EAN13 es ancho y bajo, así que hay que alejar el teléfono para encuadrarlo y ahí las barras finas pierden resolución.

Los cuatro comparten causa: se construyó la capacidad y no el camino hacia ella.

## What Changes

- Los códigos de la variante pasan a ser alcanzables desde **Editar variante**, sin dejar de estarlo desde el panel. El modal es donde la gente va a buscarlos.
- El escáner, cuando un código no resuelve, ofrece asociarlo a una variante o unidad existente sin salir del flujo. Implementa un requisito que ya está escrito.
- El campo *Proveedor* se muestra sólo en los tipos donde significa algo —`proveedor` y `empaque`—, igual que hoy ya se hace con factor y nombre de envase. En `fabricante` y `propio` desaparece.
- La ventana de escaneo por cámara se adapta a códigos 1D: ancha y baja, dimensionada sobre el viewport en vez de fija en 200 px. El QR sigue cabiendo.

## Capabilities

### New Capabilities

Ninguna. Las cuatro son correcciones de acceso y de guía sobre capacidades que ya existen.

### Modified Capabilities

- `productos-y-variantes`: el requisito *Tipo y proveedor del código* hoy dice que cualquier código "SHALL poder referenciar un proveedor", sin distinguir tipo — y esa laxitud es lo que permite el dato contradictorio. Pasa a acotar el proveedor a los tipos donde identifica un origen comercial. El requisito *Edición de producto y variante* suma que los códigos se administran desde la edición de la variante.
- `escaneo`: el requisito *Escaneo por cámara* hoy nombra sólo códigos QR, cuando la implementación ya lee EAN13, UPC y Code128 porque no restringe formatos. Pasa a declarar qué formatos debe leer y a exigir una ventana utilizable para 1D. Sin esto, una optimización futura podría restringir `formatsToSupport` a QR y nadie sabría que rompió algo que se usaba.

## Impact

**Frontend**, que es casi todo:

- `frontend/src/components/catalogo/ModalEditarVariante.tsx` — sección de códigos
- `frontend/src/pages/Catalogo.tsx` — `ModalCodigo` (proveedor condicionado por tipo) y la sección de códigos del panel, que se extrae para reutilizarla
- `frontend/src/pages/EscanearCatalogo.tsx` — alta de código tras un escaneo sin resultado
- `frontend/src/components/scanner/CameraScanner.tsx` — `qrbox` adaptado a 1D

**Backend**: sin cambios. `POST /variantes/{id}/codigos`, `POST /unidades/{id}/codigos`, `PATCH /codigos/{id}/principal` y `DELETE /codigos/{id}` ya existen y cubren todo lo necesario, incluido el 409 con "ya está registrado en otro item" que el flujo del escáner necesita.

**Datos existentes**: quedan dos códigos `fabricante` con `proveedor_id` en el tenant de demo. Este change impide crear nuevos, pero no los limpia; corregirlos es borrar y recrear desde la interfaz, que es la operación que el propio change vuelve cómoda.

**Fuera de alcance**: permitir *editar* un código en vez de borrarlo y recrearlo. Un código es un identificador físico impreso; editarlo cambia en silencio a qué apunta una etiqueta ya pegada en la bodega, y el reemplazo explícito es la conducta correcta. Queda anotado que para un dedazo al teclear es más trabajo del necesario.
