FROM node:20-alpine

WORKDIR /app

# Install dependencies first (layer cache)
COPY package.json ./
RUN npm install --omit=dev

# Copy source
COPY index.js ./

# Cloud Run injects PORT; default 8080
EXPOSE 8080

CMD ["node", "index.js"]
