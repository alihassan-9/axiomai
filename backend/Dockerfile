FROM python:3.11-slim AS base

# Tesseract + poppler for OCR of scanned invoices.
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr poppler-utils libpq5 curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Non-root runtime user
RUN useradd --create-home appuser && chown -R appuser /srv
USER appuser

EXPOSE 8000
CMD ["sh", "-c", "python scripts/init_db.py && gunicorn app.main:app -k uvicorn.workers.UvicornWorker -w 4 -b 0.0.0.0:8000 --timeout 120"]
