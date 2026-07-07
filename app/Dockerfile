FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 80

CMD ["gunicorn", "--worker-class", "gevent", "--workers", "8", "--timeout", "120", "--bind", "0.0.0.0:80", "app:app"]