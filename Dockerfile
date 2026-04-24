FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy bot files
COPY telegram_bot/ ./
COPY data/ ./data/

# Create volume for logs
VOLUME ["/app/logs"]

# Run bot
CMD ["python", "bot_v2_fixed.py"]
