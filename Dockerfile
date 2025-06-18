# Use a base image with Python
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy rest of the app
COPY . .

# Expose the correct port
EXPOSE 8080

# Set the startup command
CMD ["python", "main.py"]
