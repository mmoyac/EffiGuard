## MODIFIED Requirements

### Requirement: Logo por tenant

El Super Admin SHALL poder subir un logo por tenant en formato PNG, JPEG, WebP o SVG. El archivo se guarda bajo `/static/logos/` con nombre único y reemplaza al anterior, que se elimina del disco.

Al guardar el logo, el sistema SHALL regenerar los íconos PWA derivados de ese tenant y eliminar los derivados del logo anterior.

#### Scenario: Formato no permitido

- **WHEN** se sube un archivo con content-type fuera del set permitido
- **THEN** responde 400 con "Tipo de archivo no permitido. Use PNG, JPEG, WebP o SVG."

#### Scenario: Reemplazo de logo existente

- **WHEN** el tenant ya tenía logo
- **THEN** el archivo anterior se borra del disco, `logo_url` apunta al nuevo, y los íconos PWA derivados del logo anterior se eliminan junto con él

#### Scenario: Logo cargado en un tenant recién creado

- **WHEN** se sube el primer logo de un tenant
- **THEN** quedan disponibles sus cuatro derivados PWA y el manifiesto del tenant deja de apuntar a los íconos genéricos

#### Scenario: Falla la generación de derivados

- **WHEN** el logo se guarda correctamente pero sus derivados no pueden generarse
- **THEN** la carga del logo se considera exitosa y el manifiesto del tenant sigue sirviendo los íconos genéricos
