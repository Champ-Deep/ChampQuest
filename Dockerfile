FROM node:20-alpine

WORKDIR /app

COPY backend/package*.json ./backend/
RUN cd backend && npm ci --production

COPY backend/ ./backend/
COPY frontend/ ./frontend/

RUN mkdir -p /app/data
RUN chown -R node:node /app

USER node
EXPOSE 3000

WORKDIR /app/backend
CMD ["npm", "start"]
