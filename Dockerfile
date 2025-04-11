# Build stage
FROM node:22-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:22-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built files from builder
COPY --from=builder /app/dist ./dist
RUN ln -s /app/dist/cli.js /app/docs-cli

# Define the data directory environment variable and volume
# Environment variables
ENV DOCS_MCP_STORE_PATH=/data
ENV OPENAI_API_BASE=
ENV OPENAI_ORG_ID=
ENV DOCS_MCP_EMBEDDING_MODEL=

VOLUME /data

# Set the command to run the application
CMD ["node", "dist/server.js"]
