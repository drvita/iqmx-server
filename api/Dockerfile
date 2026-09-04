# Imagen base precompilada en Docker Hub
FROM drvita1982/iqmx-python-base:latest AS runner

WORKDIR /app

ENV PATH="/opt/venv/bin:$PATH"
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Instalar dependencias adicionales si se definen en requirements.txt
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código fuente, utilidades CLI y configuración de migraciones Alembic
COPY app/ /app/app/
COPY scripts/ /app/scripts/
COPY manage.py /app/manage.py
COPY alembic/ /app/alembic/
COPY alembic.ini /app/alembic.ini
COPY run.py /app/run.py

EXPOSE 8000

CMD ["python", "run.py"]
