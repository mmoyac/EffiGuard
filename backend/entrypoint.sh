#!/bin/sh
set -e

echo "Esperando que PostgreSQL este listo..."
until pg_isready -h postgres -U "${POSTGRES_USER:-effiguard}"; do
  sleep 1
done

echo "PostgreSQL listo. Ejecutando migraciones..."
alembic upgrade head

echo "Migraciones completadas. Iniciando aplicacion..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
