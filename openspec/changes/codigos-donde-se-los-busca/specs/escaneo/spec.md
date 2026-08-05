## MODIFIED Requirements

### Requirement: Escaneo por cámara

La página de escáner SHALL ofrecer lectura con la cámara del dispositivo como alternativa al lector físico, aceptando tanto códigos QR como códigos de barras lineales —EAN-13, EAN-8, UPC-A, UPC-E, Code 128 y Code 39—. El EAN13 impreso de fábrica es el código que más se escanea en una bodega de materiales, y llega en la caja del proveedor sin que nadie tenga que pegarle un QR.

La ventana de escaneo SHALL tener una forma utilizable para códigos lineales: ancha y baja, dimensionada sobre el ancho disponible en vez de un cuadrado fijo. Un EAN13 tiene proporción cercana a 3:1, y forzarlo dentro de un cuadrado obliga a alejar el dispositivo justo cuando las barras finas necesitan resolución.

#### Scenario: Código leído por cámara

- **WHEN** la cámara decodifica un código
- **THEN** la cámara se cierra y el código se procesa como escaneo, sea QR o de barras

#### Scenario: EAN13 impreso en el envase

- **WHEN** se enfoca con la cámara el código de barras de la caja de un consumible
- **THEN** se decodifica y resuelve a la variante, igual que si se hubiera leído con el lector físico

#### Scenario: Restricción de formatos

- **WHEN** se configura el lector de cámara
- **THEN** no se restringe el conjunto de formatos a QR, porque eso dejaría de leer los códigos impresos de fábrica

## ADDED Requirements

### Requirement: Códigos administrables desde donde se los busca

Toda pantalla que ofrezca corregir una variante o una unidad SHALL dar acceso a la administración de sus códigos. Una capacidad que existe pero vive en un lugar distinto al que el usuario abre para usarla es, en la práctica, una capacidad que no está.

#### Scenario: Usuario busca los códigos donde dice editar

- **WHEN** el usuario abre la edición de una variante con la intención de cambiar un código
- **THEN** los encuentra ahí, sin tener que descubrir que viven en otra sección de la pantalla

#### Scenario: Reemplazo de un código principal

- **WHEN** se agrega un código nuevo y se marca como principal, y luego se elimina el anterior
- **THEN** la variante nunca queda sin código principal en el intertanto
