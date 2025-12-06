# Container 3: AI Service (llama.cpp + Phi-3 + Go HTTP Server)

FROM ubuntu:22.04

# Prevent interactive prompts during build
ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    wget \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Build llama.cpp with optimizations
WORKDIR /build
RUN git clone https://github.com/ggerganov/llama.cpp.git && \
    cd llama.cpp && \
    cmake -B build \
        -DLLAMA_AVX2=ON \
        -DLLAMA_F16C=ON \
        -DLLAMA_FMA=ON \
        -DCMAKE_BUILD_TYPE=Release && \
    cmake --build build --config Release -j$(nproc)

# Create models directory
RUN mkdir -p /models

# Download Phi-3 model (4-bit quantized)
# Note: This is a large file (~2.3GB), consider downloading separately for faster builds
WORKDIR /models
RUN wget -q --show-progress \
    https://huggingface.co/microsoft/Phi-3-mini-128k-instruct-gguf/resolve/main/Phi-3-mini-128k-instruct-Q4_K_M.gguf \
    || echo "Warning: Model download failed. Please download manually."

# Build Go HTTP server
FROM golang:1.21-alpine AS go-builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY main.go .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o ai-server .

# Final stage
FROM ubuntu:22.04
RUN apt-get update && apt-get install -y \
    libgomp1 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy llama.cpp binaries
COPY --from=0 /build/llama.cpp/build/bin /usr/local/bin/

# Copy model
COPY --from=0 /models /models

# Copy Go server
COPY --from=go-builder /app/ai-server /app/ai-server

WORKDIR /app

EXPOSE 8081

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8081/health || exit 1

CMD ["/app/ai-server", "--model", "/models/Phi-3-mini-128k-instruct-Q4_K_M.gguf", "--port", "8081", "--threads", "4"]
