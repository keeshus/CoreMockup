FROM node:25-alpine
WORKDIR /app
COPY package*.json ./
COPY worker/package*.json ./worker/
RUN npm install -w worker --omit=dev
COPY worker/ ./worker/
CMD ["node", "worker/index.js"]
