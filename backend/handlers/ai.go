package handlers

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type AIHandler struct {
	AIServiceURL string
}

type AIQueryRequest struct {
	Prompt      string  `json:"prompt" binding:"required"`
	Temperature float64 `json:"temperature"`
	MaxTokens   int     `json:"max_tokens"`
}

type AIQueryResponse struct {
	Response string `json:"response"`
	Tokens   int    `json:"tokens"`
}

// Query proxies AI queries to the AI service
func (h *AIHandler) Query(c *gin.Context) {
	var req AIQueryRequest
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

	// Forward request to AI service
	jsonData, err := json.Marshal(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to marshal request"})
		return
	}

	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	resp, err := client.Post(h.AIServiceURL+"/query", "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "AI service unavailable"})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.JSON(resp.StatusCode, gin.H{"error": "AI service returned error"})
		return
	}

	// Read and forward response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read AI response"})
		return
	}

	var aiResp AIQueryResponse
	if err := json.Unmarshal(body, &aiResp); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse AI response"})
		return
	}

	c.JSON(http.StatusOK, aiResp)
}

// Health checks the AI service health
func (h *AIHandler) Health(c *gin.Context) {
	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	resp, err := client.Get(h.AIServiceURL + "/health")
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status": "unavailable",
			"error":  err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		c.JSON(http.StatusOK, gin.H{"status": "healthy"})
	} else {
		c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unhealthy"})
	}
}
