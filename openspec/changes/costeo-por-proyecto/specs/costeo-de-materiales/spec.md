## ADDED Requirements

### Requirement: Costo congelado en el movimiento

Cada movimiento de inventario SHALL registrar el costo unitario vigente del activo en el instante en que ocurre. El costo del movimiento es su cantidad por ese costo unitario, y no se recalcula nunca desde el precio actual del activo.

#### Scenario: El precio sube después del consumo

- **WHEN** un proyecto consumió material a $120 la unidad y meses después el precio sube a $180
- **THEN** el costo de ese consumo sigue siendo $120 por unidad, porque es lo que costó cuando ocurrió

#### Scenario: Activo sin precio configurado

- **WHEN** ocurre un movimiento sobre un activo que no tiene precio de compra
- **THEN** el movimiento se registra sin costo unitario, y no se le asigna cero

#### Scenario: Precisión del costo unitario

- **WHEN** el costo unitario resulta de una división con decimales periódicos
- **THEN** se almacena con cuatro decimales y sólo se redondea al presentarlo

### Requirement: La compra establece el precio, no lo hereda

El registro de una compra SHALL aceptar el total pagado y usarlo para valorizar ese movimiento, por sobre el precio configurado en el activo. La compra es el único movimiento donde el precio se conoce con certeza: los demás lo heredan, éste lo establece.

#### Scenario: Precio de la factura distinto del configurado

- **WHEN** el activo tiene $120 configurado y se registra una compra de 100 unidades por $13.500
- **THEN** el movimiento queda valorizado a $135 por unidad, que es lo que efectivamente se pagó

#### Scenario: Precio expresado como total

- **WHEN** llegan 3 cajas de 100 y la factura dice $36.000
- **THEN** el costo unitario resulta de dividir el total por las 300 unidades ingresadas, y la interfaz muestra la división antes de confirmar

#### Scenario: Compra sin precio

- **WHEN** no se informa el total pagado
- **THEN** la compra se registra usando el precio configurado del activo, o sin valorizar si no lo tiene

#### Scenario: Precio no positivo

- **WHEN** el total informado es menor o igual a cero
- **THEN** responde 422 indicando que debe ser mayor a 0

### Requirement: El precio del producto se mantiene con las compras

Al registrar una compra con precio, el sistema SHALL actualizar por defecto el `precio_compra` del activo con el valor recién pagado, permitiendo declinar esa actualización.

#### Scenario: Precio vigente tras la compra

- **WHEN** se compra a un precio distinto y se acepta la actualización
- **THEN** el consumo posterior se valoriza al precio nuevo, sin que nadie deba editarlo a mano

#### Scenario: Compra de emergencia a sobreprecio

- **WHEN** el comprador declina la actualización
- **THEN** el movimiento queda valorizado al precio pagado, pero el precio del producto no cambia y el resto del stock conserva su valorización

#### Scenario: El histórico no se altera

- **WHEN** una compra actualiza el precio del producto
- **THEN** los movimientos anteriores conservan su costo congelado, porque el precio nuevo rige desde esa compra en adelante

### Requirement: Costo de materiales consumidos por proyecto

El sistema SHALL calcular, por proyecto, el costo del material efectivamente consumido, entendido como los despachos valorizados menos sus reintegros valorizados.

#### Scenario: Consumo neto valorizado

- **WHEN** a un proyecto salieron 100 unidades a $120 y volvieron 20
- **THEN** su costo de materiales es $9.600, correspondiente a las 80 unidades consumidas

#### Scenario: Proyecto sin consumo

- **WHEN** un proyecto no registra despachos
- **THEN** su costo de materiales es cero

#### Scenario: Movimientos sin proyecto

- **WHEN** un retiro se registró sin imputar proyecto
- **THEN** su costo no se asigna a ningún proyecto

### Requirement: Pérdidas y mermas valorizadas

El sistema SHALL valorizar las pérdidas y las mermas. Las pérdidas de activos prestables se valorizan a su valor de reposición; las de consumibles y las mermas, al costo unitario congelado en el movimiento.

#### Scenario: Herramienta robada

- **WHEN** se reporta la pérdida de una herramienta con valor de reposición $180.000
- **THEN** el costo de la pérdida es $180.000, porque lo que cuesta es reemplazarla

#### Scenario: Consumible perdido

- **WHEN** se reportan 50 unidades perdidas de un consumible costeado a $120
- **THEN** el costo de la pérdida es $6.000, el dinero que ya se había gastado en ellas

#### Scenario: Merma valorizada

- **WHEN** se descartan 30 unidades por daño
- **THEN** su costo se reporta en la línea de mermas, separado del consumo

### Requirement: Presentación en líneas separadas

El costo de material de un proyecto SHALL presentarse en tres líneas distintas —consumo, pérdidas y mermas— sin consolidarse en un único monto.

#### Scenario: Proyecto con robo

- **WHEN** un proyecto tiene consumo por $1.200.000 y pérdidas por $180.000
- **THEN** ambos montos se muestran por separado, de modo que la pérdida sea visible y no quede diluida dentro del consumo

#### Scenario: Alcance declarado en la interfaz

- **WHEN** se presenta el costo de un proyecto
- **THEN** se titula como costo de materiales y no como costo del proyecto, porque no incluye mano de obra ni uso de herramientas

### Requirement: Panel de gasto acumulado por proyecto activo

El dashboard SHALL mostrar el gasto en materiales acumulado a la fecha de cada proyecto activo, ordenado de mayor a menor, para responder de un vistazo cuánto lleva gastado cada obra en curso.

#### Scenario: Vista operativa

- **WHEN** se consulta el panel
- **THEN** lista sólo los proyectos activos, porque son los que todavía admiten decisiones sobre su gasto

#### Scenario: Orden por gasto

- **WHEN** hay varios proyectos activos
- **THEN** se listan de mayor a menor gasto acumulado, para que el más costoso quede primero

#### Scenario: Proyecto cerrado

- **WHEN** un proyecto se desactiva
- **THEN** deja de aparecer en el panel, y su costo final sigue disponible en la consulta por proyecto

#### Scenario: Desglose accesible

- **WHEN** se abre un proyecto del panel
- **THEN** se muestran sus tres líneas —consumo, pérdidas y mermas— sin necesidad de salir del dashboard

#### Scenario: Sin proyectos activos

- **WHEN** el tenant no tiene proyectos activos
- **THEN** el panel se omite en lugar de mostrarse vacío

### Requirement: Movimientos no valorizados informados

Todo total de costo SHALL indicar cuántos movimientos quedaron sin valorizar por falta de precio configurado.

#### Scenario: Precio configurado después de los movimientos

- **WHEN** un proyecto tiene movimientos anteriores a la configuración del precio
- **THEN** el total informa cuántos movimientos no pudo valorizar, en vez de contarlos como cero

#### Scenario: Todo valorizado

- **WHEN** todos los movimientos del proyecto tienen costo
- **THEN** no se muestra advertencia alguna
