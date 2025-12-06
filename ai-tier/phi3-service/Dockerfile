FROM ubuntu:22.04

# Install build dependencies
RUN apt-get update && apt-get install -y \
    cmake \
    g++ \
    make \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy source code
COPY src ./src
COPY include ./include
COPY CMakeLists.txt .

# Build the application
RUN mkdir build && cd build && \
    cmake .. && \
    make && \
    make install

# Create non-root user
RUN groupadd -r ai && useradd -r -g ai ai && \
    chown -R ai:ai /app

USER ai

# Expose port
EXPOSE 11434

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:11434/health || exit 1

# Run the server
CMD ["/usr/local/bin/phi3-server", "11434"]
