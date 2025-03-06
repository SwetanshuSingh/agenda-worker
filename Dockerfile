FROM oven/bun:1.0 AS builder

WORKDIR /app

# Copy package files for dependency installation
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy only necessary files for build
COPY prisma ./prisma/
COPY src ./src/
COPY tsconfig.json ./

# Generate Prisma client
RUN bunx prisma generate

# Build the application
RUN bun run build

# Production stage
FROM oven/bun:1.0-slim AS production

WORKDIR /app

# Set environment variables
ENV NODE_ENV=production

# Copy package files for production dependencies only
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production

# Copy Prisma schema and generated client (needed for runtime)
COPY --from=builder /app/prisma/schema.prisma ./prisma/
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Run the application
CMD ["bun", "start"] 