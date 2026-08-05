## 1. Backend

- [x] 1.1 `GET /api/v1/users`: filtro opcional `role_id`
- [x] 1.2 `GET /api/v1/projects`: filtro opcional `solo_activos`, por defecto false para no alterar la pantalla de mantención
- [x] 1.3 `VarianteWithdraw`: `project_id` pasa a obligatorio
- [x] 1.4 `services/catalogo.retirar`: validar que el operario tenga rol operario
- [x] 1.5 `services/catalogo.retirar`: validar que el proyecto exista, sea del tenant y esté activo

## 2. Frontend

- [x] 2.1 `ModalEntrega`: el selector de operarios pide sólo rol operario
- [x] 2.2 `ModalEntrega`: el selector de proyectos pide sólo activos y deja de decir "opcional"
- [x] 2.3 `ModalEntrega`: sin obras activas, explicar que hay que crear una en vez de mostrar el selector vacío
- [x] 2.4 `ModalEntrega`: el botón Entregar exige proyecto
- [x] 2.5 Aplicar los mismos selectores en `ModalPrestamo` y `ModalDescuento`

## 3. Verificación

- [x] 3.1 Retiro con un bodeguero como receptor → rechazado
- [x] 3.2 Retiro sin proyecto → rechazado
- [x] 3.3 Retiro contra una obra cerrada → rechazado
- [x] 3.4 Retiro válido → descuenta stock e imputa a la obra
- [x] 3.5 El gasto por obra refleja el retiro, con el detalle por material
