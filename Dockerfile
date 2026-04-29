FROM node:20-slim

# Install build tools for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install
COPY package*.json ./
RUN npm ci --production

# Copy app source
COPY . .

# Expose port
EXPOSE 3000

# Start
CMD ["node", "server.js"]
