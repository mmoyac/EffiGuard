#!/bin/sh
# Uso: ./add-tenant.sh propublix
# Ejecutar en el VPS desde cualquier directorio
#
# Qué hace:
#   1. Crea el archivo de configuración nginx para ese tenant
#   2. Recarga nginx
#
# El cert wildcard *.lexastech.cl ya cubre todos los subdominios — no hay que generar nada.

set -e

SLUG=$1
DOMAIN="effiguard-${SLUG}.lexastech.cl"
NGINX_PROXY_DIR="/root/docker/nginx-proxy"
CONF_FILE="${NGINX_PROXY_DIR}/conf.d/effiguard-${SLUG}.conf"
TEMPLATE="/root/docker/EffiGuard/nginx-effiguard.conf"

if [ -z "$SLUG" ]; then
  echo "Error: debes indicar el slug del tenant"
  echo "Uso: $0 <slug>"
  echo "Ejemplo: $0 propublix"
  exit 1
fi

if [ -f "$CONF_FILE" ]; then
  echo "Error: el tenant ${SLUG} ya existe (${CONF_FILE})"
  exit 1
fi

echo "Agregando tenant: ${SLUG} (${DOMAIN})"

# 1. Crear conf nginx desde plantilla
echo "Creando configuracion nginx..."
sed "s/TENANT_SLUG/${SLUG}/g" "${TEMPLATE}" > "${CONF_FILE}"
echo "Archivo creado: ${CONF_FILE}"

# 2. Recargar nginx
echo "Recargando nginx..."
docker exec nginx_proxy nginx -t && docker exec nginx_proxy nginx -s reload

echo ""
echo "Tenant ${SLUG} listo en https://${DOMAIN}"
echo "Recuerda crear el tenant en la base de datos con slug=${SLUG}"
