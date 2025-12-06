package middleware

import (
	"log"
	"time"

	"github.com/gin-gonic/gin"
)

// Logger is a middleware that logs HTTP requests
func Logger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		method := c.Request.Method

		c.Next()

		latency := time.Since(start)
		statusCode := c.Writer.Status()
		clientIP := c.ClientIP()

		log.Printf("[%s] %s %s - %d - %v - %s",
			method,
			path,
			clientIP,
			statusCode,
			latency,
			c.Errors.String(),
		)
	}
}

// Recovery is a middleware that recovers from panics
func Recovery() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				log.Printf("Panic recovered: %v", err)
				c.JSON(500, gin.H{"error": "Internal server error"})
				c.Abort()
			}
		}()
		c.Next()
	}
}
