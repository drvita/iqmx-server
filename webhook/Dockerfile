# Imagen base precompilada en Docker Hub
FROM drvita1982/iqmx-python-base:latest AS runner

WORKDIR /app

ENV PATH="/opt/venv/bin:$PATH"
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Copiar únicamente el código fuente de la aplicación
COPY app/ /app/app/
COPY run.py /app/run.py

EXPOSE 8000

CMD ["python", "run.py"]
