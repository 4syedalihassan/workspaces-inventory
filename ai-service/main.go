package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// QueryRequest represents an AI query request
type QueryRequest struct {
	Prompt      string  `json:"prompt" binding:"required"`
	Temperature float64 `json:"temperature"`
	MaxTokens   int     `json:"max_tokens"`
}

// QueryResponse represents an AI query response
type QueryResponse struct {
	Response string `json:"response"`
	Tokens   int    `json:"tokens"`
	Latency  int64  `json:"latency_ms"`
}

var (
	modelPath      string
	threads        int
	contextSize    int
	llamaCppBinary string
)

func main() {
	port := flag.Int("port", 8081, "Server port")
	flag.StringVar(&modelPath, "model", "/models/Phi-3-mini-128k-instruct-Q4_K_M.gguf", "Path to GGUF model")
	flag.IntVar(&threads, "threads", 4, "Number of threads for inference")
	flag.IntVar(&contextSize, "context", 8192, "Context size")
	flag.StringVar(&llamaCppBinary, "llama-binary", "/usr/local/bin/main", "Path to llama.cpp binary")
	flag.Parse()

	// Verify model exists
	if _, err := os.Stat(modelPath); os.IsNotExist(err) {
		log.Fatalf("Model file not found: %s", modelPath)
	}

	// Verify llama.cpp binary exists
	if _, err := os.Stat(llamaCppBinary); os.IsNotExist(err) {
		log.Fatalf("llama.cpp binary not found: %s", llamaCppBinary)
	}

	// Initialize Gin
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(loggerMiddleware())

	// Routes
	r.POST("/query", queryHandler)
	r.GET("/health", healthHandler)
	r.GET("/info", infoHandler)

	// Start server
	log.Printf("AI Service starting on port %d", *port)
	log.Printf("Model: %s", modelPath)
	log.Printf("Threads: %d", threads)
	log.Printf("Context size: %d", contextSize)

	if err := r.Run(fmt.Sprintf(":%d", *port)); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func queryHandler(c *gin.Context) {
	startTime := time.Now()

	var req QueryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Set defaults
	if req.Temperature == 0 {
		req.Temperature = 0.1
	}
	if req.MaxTokens == 0 {
		req.MaxTokens = 512
	}

	// Build system prompt for text-to-SQL
	systemPrompt := `You are a SQL query generator for AWS WorkSpaces inventory.
Database schema:
- workspaces (workspace_id, user_name, state, bundle_id, running_mode, created_at, terminated_at)
- workspace_usage (workspace_id, month, usage_hours)
- billing_data (workspace_id, service, usage_type, start_date, end_date, amount)
- cloudtrail_events (event_id, event_name, event_time, workspace_id, username)

Generate ONLY the SQL query, no explanations.`

	fullPrompt := fmt.Sprintf("%s\n\nUser request: %s\n\nSQL Query:", systemPrompt, req.Prompt)

	// Build llama.cpp command
	args := []string{
		"-m", modelPath,
		"-p", fullPrompt,
		"-n", fmt.Sprintf("%d", req.MaxTokens),
		"--temp", fmt.Sprintf("%.2f", req.Temperature),
		"-t", fmt.Sprintf("%d", threads),
		"-c", fmt.Sprintf("%d", contextSize),
		"--log-disable",
		"--no-display-prompt",
	}

	cmd := exec.Command(llamaCppBinary, args...)

	// Capture output
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	// Run inference
	log.Printf("Running inference for prompt: %s", req.Prompt)
	if err := cmd.Run(); err != nil {
		log.Printf("Inference error: %v, stderr: %s", err, stderr.String())
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "Inference failed",
			"detail": stderr.String(),
		})
		return
	}

	// Parse output
	output := stdout.String()
	response := strings.TrimSpace(output)

	// Extract SQL query from output (remove any extra text)
	response = cleanSQLResponse(response)

	latency := time.Since(startTime).Milliseconds()

	resp := QueryResponse{
		Response: response,
		Tokens:   countTokens(response),
		Latency:  latency,
	}

	log.Printf("Inference completed in %dms, tokens: %d", latency, resp.Tokens)

	c.JSON(http.StatusOK, resp)
}

func healthHandler(c *gin.Context) {
	// Check if model file exists
	if _, err := os.Stat(modelPath); os.IsNotExist(err) {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status": "unhealthy",
			"error":  "Model file not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "healthy",
		"model":  modelPath,
	})
}

func infoHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"model":        modelPath,
		"threads":      threads,
		"context_size": contextSize,
		"version":      "1.0.0",
	})
}

func loggerMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		method := c.Request.Method

		c.Next()

		latency := time.Since(start)
		statusCode := c.Writer.Status()

		log.Printf("[%s] %s - %d - %v", method, path, statusCode, latency)
	}
}

func countTokens(text string) int {
	// Simple token estimation (word count * 1.3)
	words := strings.Fields(text)
	return int(float64(len(words)) * 1.3)
}

func cleanSQLResponse(response string) string {
	// Remove common prefixes
	response = strings.TrimPrefix(response, "SQL Query:")
	response = strings.TrimPrefix(response, "Query:")

	// Remove markdown code blocks
	response = strings.ReplaceAll(response, "```sql", "")
	response = strings.ReplaceAll(response, "```", "")

	// Trim whitespace
	response = strings.TrimSpace(response)

	return response
}
