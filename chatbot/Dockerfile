FROM python:3.11-slim

# Install system dependencies required for building psycopg/pg libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY . .

# Expose target port for FastAPI Webhook service
EXPOSE 8000

# Set environment defaults
ENV PORT=8000
ENV DATABASE_TYPE=sqlite

# Run app using uvicorn
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
