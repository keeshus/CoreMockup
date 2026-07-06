FROM node:25-alpine
WORKDIR /app
COPY package*.json ./
COPY backend/package*.json ./backend/
RUN npm install -w backend --omit=dev
COPY backend/ ./backend/
EXPOSE 3001
CMD ["node", "backend/index.js"]
