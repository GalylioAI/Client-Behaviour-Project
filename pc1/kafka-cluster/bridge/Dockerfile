FROM python:3.12-slim

WORKDIR /app

# Install dependencies first (cached layer — only rebuilds if requirements.txt changes)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY *.py .

EXPOSE 8080

# Keep one worker until metrics are moved to shared storage; in-process counters
# become misleading when uvicorn forks multiple workers.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1", "--log-level", "info"]
