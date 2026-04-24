FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY server.js ./

# Статика монтируется из хоста через volume (см. docker-compose)
ENV STATIC_DIR=/app/static
RUN mkdir -p /app/static

EXPOSE 3000
CMD ["node", "server.js"]
