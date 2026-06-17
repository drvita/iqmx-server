# Etapa 1: Constructor (Builder)
FROM python:3.11-slim AS builder

WORKDIR /app

# Instalar dependencias del sistema mínimas necesarias
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Crear entorno virtual aislado
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Instalar dependencias de Python
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Etapa 2: Imagen Final de Ejecución (Runner)
FROM python:3.11-slim AS runner

WORKDIR /app

# Copiar el entorno virtual con sus dependencias compiladas
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Variables de entorno para Python optimizado
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Copiar el código fuente de la aplicación
COPY app/ /app/app/
COPY run.py /app/run.py

EXPOSE 8000

# Comando para arrancar el servidor usando run.py
CMD ["python", "run.py"]

