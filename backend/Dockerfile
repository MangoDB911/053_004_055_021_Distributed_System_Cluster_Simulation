FROM python:3.9-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install -r requirements.txt

COPY backend .
CMD ["python", "app.py"]