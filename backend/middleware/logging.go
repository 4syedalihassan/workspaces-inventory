package middleware

import (
	"bytes"
	"fmt"
	"io"
	"log"
	"runtime/debug"
	"time"

	"github.com/gin-gonic/gin"
)

// Logger is a comprehensive middleware that logs HTTP requests with detailed information
func Logger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		raw := c.Request.URL.RawQuery
		method := c.Request.Method

		// Get username from context if authenticated
		username := "anonymous"
		if user, exists := c.Get("username"); exists {
			if u, ok := user.(string); ok {
				username = u
			}
		}

		// Read request body for POST/PUT/PATCH requests (for logging)
		var requestBody string
		if method == "POST" || method == "PUT" || method == "PATCH" {
			bodyBytes, _ := io.ReadAll(c.Request.Body)
			c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

			// Only log non-sensitive endpoints
			if !isSensitiveEndpoint(path) {
				requestBody = string(bodyBytes)
				if len(requestBody) > 500 {
					requestBody = requestBody[:500] + "... (truncated)"
				}
			} else {
				requestBody = "[REDACTED - Sensitive Data]"
			}
		}

		c.Next()

		latency := time.Since(start)
		statusCode := c.Writer.Status()
		clientIP := c.ClientIP()
		userAgent := c.Request.UserAgent()

		// Build query string
		if raw != "" {
			path = path + "?" + raw
		}

		// Color code based on status
		statusColor := getStatusColor(statusCode)
		methodColor := getMethodColor(method)

		// Log with detailed information
		logMessage := fmt.Sprintf("[%s%s\033[0m] %s%s\033[0m | %d | %13v | %15s | %s | User: %s",
			statusColor,
			fmt.Sprintf("%3d", statusCode),
			methodColor,
			fmt.Sprintf("%-7s", method),
			c.Writer.Size(),
			latency,
			clientIP,
			path,
			username,
		)

		// Add errors if any
		if len(c.Errors) > 0 {
			logMessage += fmt.Sprintf(" | Errors: %s", c.Errors.String())
		}

		// Add request body for non-GET requests in debug mode
		if (method == "POST" || method == "PUT" || method == "PATCH") && requestBody != "" && statusCode >= 400 {
			logMessage += fmt.Sprintf(" | Body: %s", requestBody)
		}

		log.Println(logMessage)

		// Log slow requests (> 1 second)
		if latency > time.Second {
			log.Printf("[SLOW REQUEST] %s %s took %v (User: %s, IP: %s, UA: %s)",
				method, path, latency, username, clientIP, userAgent)
		}

		// Log errors separately
		if statusCode >= 500 {
			log.Printf("[SERVER ERROR] %s %s - Status: %d, User: %s, IP: %s, Errors: %s",
				method, path, statusCode, username, clientIP, c.Errors.String())
		} else if statusCode >= 400 {
			log.Printf("[CLIENT ERROR] %s %s - Status: %d, User: %s, IP: %s",
				method, path, statusCode, username, clientIP)
		}
	}
}

// Recovery is a middleware that recovers from panics with detailed logging
func Recovery() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				// Get stack trace
				stack := string(debug.Stack())

				// Log panic with stack trace
				log.Printf("\033[31m[PANIC RECOVERED]\033[0m %v\n%s", err, stack)

				// Get user info if available
				username := "anonymous"
				if user, exists := c.Get("username"); exists {
					if u, ok := user.(string); ok {
						username = u
					}
				}

				log.Printf("[PANIC CONTEXT] Method: %s, Path: %s, User: %s, IP: %s",
					c.Request.Method, c.Request.URL.Path, username, c.ClientIP())

				c.JSON(500, gin.H{
					"error":   "Internal server error",
					"message": "An unexpected error occurred. Please try again later.",
				})
				c.Abort()
			}
		}()
		c.Next()
	}
}

// getStatusColor returns ANSI color code based on HTTP status
func getStatusColor(code int) string {
	switch {
	case code >= 200 && code < 300:
		return "\033[32m" // Green
	case code >= 300 && code < 400:
		return "\033[36m" // Cyan
	case code >= 400 && code < 500:
		return "\033[33m" // Yellow
	default:
		return "\033[31m" // Red
	}
}

// getMethodColor returns ANSI color code based on HTTP method
func getMethodColor(method string) string {
	switch method {
	case "GET":
		return "\033[34m" // Blue
	case "POST":
		return "\033[32m" // Green
	case "PUT":
		return "\033[33m" // Yellow
	case "DELETE":
		return "\033[31m" // Red
	case "PATCH":
		return "\033[35m" // Magenta
	default:
		return "\033[37m" // White
	}
}

// isSensitiveEndpoint checks if the endpoint contains sensitive data
func isSensitiveEndpoint(path string) bool {
	sensitiveEndpoints := []string{
		"/auth/login",
		"/auth/mfa",
		"/admin/users",
		"/admin/settings",
	}

	for _, endpoint := range sensitiveEndpoints {
		if len(path) >= len(endpoint) && path[:len(endpoint)] == endpoint {
			return true
		}
	}

	return false
}
