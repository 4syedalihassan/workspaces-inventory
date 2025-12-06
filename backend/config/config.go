package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

// Config holds all configuration for the application
type Config struct {
	// Server
	Port        string
	Environment string

	// Database
	DatabaseURL string

	// Redis
	RedisURL string

	// AWS
	AWSRegion          string
	AWSAccessKeyID     string
	AWSSecretAccessKey string

	// JWT
	JWTSecret string

	// DUO MFA
	DUOIntegrationKey string
	DUOSecretKey      string
	DUOAPIHostname    string

	// AI Service
	AIServiceURL string

	// Sync
	SyncSchedule string
}

// Load reads configuration from environment variables
func Load() *Config {
	// Load .env file if it exists (for local development)
	_ = godotenv.Load()

	cfg := &Config{
		Port:        getEnv("PORT", "8080"),
		Environment: getEnv("ENVIRONMENT", "development"),

		DatabaseURL: getEnv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/workspaces?sslmode=disable"),
		RedisURL:    getEnv("REDIS_URL", "redis://localhost:6379/0"),

		AWSRegion:          getEnv("AWS_REGION", "us-east-1"),
		AWSAccessKeyID:     getEnv("AWS_ACCESS_KEY_ID", ""),
		AWSSecretAccessKey: getEnv("AWS_SECRET_ACCESS_KEY", ""),

		JWTSecret: getEnv("JWT_SECRET", "change-me-in-production"),

		DUOIntegrationKey: getEnv("DUO_IKEY", ""),
		DUOSecretKey:      getEnv("DUO_SKEY", ""),
		DUOAPIHostname:    getEnv("DUO_API_HOSTNAME", ""),

		AIServiceURL: getEnv("AI_SERVICE_URL", "http://localhost:8081"),

		SyncSchedule: getEnv("SYNC_SCHEDULE", "0 */6 * * *"),
	}

	// Validate required fields in production
	if cfg.Environment == "production" {
		if cfg.JWTSecret == "change-me-in-production" {
			log.Fatal("JWT_SECRET must be set in production")
		}
		if cfg.DUOIntegrationKey == "" || cfg.DUOSecretKey == "" {
			log.Fatal("DUO MFA credentials must be set in production")
		}
	}

	return cfg
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
