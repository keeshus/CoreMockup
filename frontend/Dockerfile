FROM node:25-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY frontend/package*.json ./frontend/
RUN npm install -w frontend
COPY frontend/ ./frontend/
RUN npm run build -w frontend

FROM node:25-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/frontend/.next ./frontend/.next
COPY --from=builder /app/frontend/public ./frontend/public
EXPOSE 3000
CMD ["npm", "start", "-w", "frontend"]
