FROM node:18-slim AS builder

WORKDIR /app

# Copy package files for dependency installation
COPY package.json package-lock.json* ./

# Install dependencies including dev dependencies
RUN npm ci

# Copy project files
COPY prisma ./prisma/
COPY src ./src/
COPY tsconfig.json ./

# Generate Prisma client
RUN npx prisma generate

# Build the TypeScript application
RUN npm run build

# Production stage
FROM node:18-slim AS production

WORKDIR /app

# Set environment variables
ENV NODE_ENV=production

# Copy package files for production dependencies only
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy Prisma schema and generated client (needed for runtime)
COPY --from=builder /app/prisma/schema.prisma ./prisma/
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Run the application
CMD ["node", "dist/index.js"] 