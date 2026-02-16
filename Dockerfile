# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend-react
COPY frontend-react/package*.json ./
RUN npm ci
COPY frontend-react/ ./
RUN npm run build
# Output is in /app/frontend-build/

# Stage 2: Production server
FROM node:20-alpine

WORKDIR /app

# Backend dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --production

# Backend source
COPY backend/ ./backend/

# React build output from Stage 1
COPY --from=frontend-build /app/frontend-build ./frontend-build/

# Keep vanilla frontend as fallback
COPY frontend/ ./frontend/

RUN mkdir -p /app/data
RUN chown -R node:node /app

USER node
EXPOSE 3000

WORKDIR /app/backend
CMD ["npm", "start"]
