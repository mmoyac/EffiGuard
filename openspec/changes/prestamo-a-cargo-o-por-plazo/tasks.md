## 1. Modelo y migración

- [x] 1.1 Agregar `modalidad` a `models/loan.py` (`String(10)`, `NOT NULL`, default `plazo`) con las constantes válidas declaradas junto al modelo, al estilo de `codigos.TIPOS_VALIDOS`
- [x] 1.2 Crear la migración `029_modalidad_de_prestamo.py` que agrega la columna con default `'plazo'`, dejando los préstamos existentes como préstamos por plazo
- [x] 1.3 Aplicar la migración y verificar que los préstamos abiertos siguen comportándose igual que antes

## 2. Backend — creación del préstamo

- [x] 2.1 Agregar `modalidad` a `LoanCreate` en `schemas/loan.py` con default `plazo` y validación de los dos valores admitidos (422 ante cualquier otro)
- [x] 2.2 Exponer `modalidad` en `LoanResponse` y `ActiveLoanResponse`
- [x] 2.3 Rechazar con 400 la combinación `modalidad = a_cargo` + `fecha_devolucion_prevista`, con el mensaje "Una entrega a cargo no lleva fecha de devolución"
- [x] 2.4 En `services/prestamo.py`, resolver el límite efectivo de la unidad (variante → familia) y rechazar con 400 el plazo que lo supere, nombrando el máximo: "El plazo máximo para esta herramienta es de N días"
- [x] 2.5 Persistir la modalidad en `LoanRepository.create` y propagarla, junto con el plazo, a todas las piezas del kit
- [x] 2.6 Pasar `modalidad` desde el router `POST /api/v1/loans` al servicio

## 3. Backend — vencidos

- [x] 3.1 En `api/v1/dashboard.py`, excluir en la consulta los préstamos `a_cargo` y dejar de exigir que exista `dias_max_prestamo` para traer la fila: ahora un préstamo con fecha pactada vence aunque el catálogo no tenga límite
- [x] 3.2 Implementar la precedencia del plazo: fecha pactada si existe, límite del catálogo si no, exclusión si no hay ninguno
- [x] 3.3 Agregar `origen_plazo` (`pactado` | `catalogo`) a la respuesta y calcular `dias_max` como los días entre entrega y fecha prevista cuando el plazo es pactado
- [x] 3.4 Verificar que `dias_transcurridos` y `dias_excedido` siguen siendo coherentes con el nuevo origen del plazo

## 4. Frontend — registrar el préstamo

- [x] 4.1 Agregar en `ModalPrestamo.tsx` el selector de modalidad: dos botones táctiles de 48px, "Por N días" preseleccionado y "A cargo"
- [x] 4.2 Mostrar junto al campo de días el techo que permite el catálogo para esa herramienta, y validar antes de enviar
- [x] 4.3 Al elegir "A cargo", ocultar el campo de días y declarar la consecuencia: queda a cargo del operario y no se le pedirá devolución
- [x] 4.4 Al recibir el rechazo por plazo excedido, ofrecer entregarla a cargo como alternativa en vez de sólo informar el error
- [x] 4.5 Enviar `modalidad` en el `POST` y agregar el campo a los tipos de `types/index.ts`

## 5. Frontend — dónde se ve

- [x] 5.1 Mostrar en `Loans.tsx` el distintivo "A cargo" y suprimir para esos préstamos el cálculo de vencido del cliente
- [x] 5.2 Hacer lo mismo en `MyLoans.tsx`, de modo que el operario vea qué tiene a cargo y qué debe devolver
- [x] 5.3 En `EscanearCatalogo.tsx`, presentar el préstamo activo según su modalidad: "A cargo de <nombre> desde <fecha>" sin plazo ni atraso, o la fecha de devolución cuando es por plazo
- [x] 5.4 Mostrar el origen del plazo en el panel de vencidos del dashboard

## 6. Cierre

- [x] 6.1 Probar el flujo completo a cargo: entregar, verificar En Terreno y log de `entrega`, adelantar la fecha y confirmar que no aparece en vencidos, devolver y verificar que la unidad vuelve a Disponible
- [x] 6.2 Probar que un plazo pactado más largo que el límite del catálogo se rechaza, y que uno dentro del límite se acepta y vence en la fecha acordada
- [x] 6.3 Probar que un préstamo con fecha pactada ya pasada aparece como vencido con origen `pactado`, aunque el catálogo permita más días
- [x] 6.4 Probar un kit entregado a cargo: las tres piezas quedan `a_cargo` y ninguna entra a vencidos
- [x] 6.5 Probar que un préstamo creado sin `modalidad` se comporta exactamente como antes del cambio
