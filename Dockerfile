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

# Define environment variables with defaults
# OpenAI (default provider)
ENV OPENAI_API_BASE=""
ENV OPENAI_ORG_ID=""

# Google Cloud - Vertex AI
ENV GOOGLE_APPLICATION_CREDENTIALS=""

# Google Generative AI (Gemini)
ENV GOOGLE_API_KEY=""

# AWS Bedrock
ENV AWS_ACCESS_KEY_ID=""
ENV AWS_SECRET_ACCESS_KEY=""
ENV AWS_REGION=""
ENV BEDROCK_AWS_REGION=""

# Azure OpenAI
ENV AZURE_OPENAI_API_KEY=""
ENV AZURE_OPENAI_API_INSTANCE_NAME=""
ENV AZURE_OPENAI_API_DEPLOYMENT_NAME=""
ENV AZURE_OPENAI_API_VERSION=""

# Core configuration
ENV DOCS_MCP_STORE_PATH=/data
ENV DOCS_MCP_EMBEDDING_MODEL=""

# Define volumes
VOLUME /data

# Set the command to run the application
CMD ["node", "dist/server.js"]
