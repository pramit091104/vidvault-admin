FROM node:18-slim

# Install FFmpeg and other build dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install --production

# Copy source code
COPY . .

# Expose port (Railway sets PORT env var)
EXPOSE 3000

# Start server
CMD ["npm", "start"]
