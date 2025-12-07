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
    libcurl4-openssl-dev \
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
# This is a large file (~2.3GB) - will take several minutes
WORKDIR /models
RUN echo "Starting model download (2.3GB)..." && \
    curl -L --fail --progress-bar --max-time 1800 \
    "https://huggingface.co/microsoft/Phi-3-mini-128k-instruct-gguf/resolve/main/Phi-3-mini-128k-instruct-Q4_K_M.gguf?download=true" \
    -o Phi-3-mini-128k-instruct-Q4_K_M.gguf && \
    echo "Download complete!" && \
    ls -lh Phi-3-mini-128k-instruct-Q4_K_M.gguf && \
    test -f Phi-3-mini-128k-instruct-Q4_K_M.gguf || (echo "ERROR: Model file not created!" && exit 1)

# Build Go HTTP server
FROM golang:1.21-alpine AS go-builder
WORKDIR /app
COPY . .
RUN go mod tidy
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

# Verify model was copied
RUN ls -lh /models/ && \
    test -f /models/Phi-3-mini-128k-instruct-Q4_K_M.gguf || \
    (echo "ERROR: Model file not found in final stage!" && exit 1)

# Copy Go server
COPY --from=go-builder /app/ai-server /app/ai-server

WORKDIR /app

EXPOSE 8081

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8081/health || exit 1

CMD ["/app/ai-server", "--model", "/models/Phi-3-mini-128k-instruct-Q4_K_M.gguf", "--port", "8081", "--threads", "4", "--llama-binary", "/usr/local/bin/llama-cli"]
