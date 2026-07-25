FROM node:22

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy source
COPY . .

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "src/server.js"]
