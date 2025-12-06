package main

import (
	"log"

	"github.com/4syedalihassan/workspaces-inventory/config"
	"github.com/4syedalihassan/workspaces-inventory/database"
	"github.com/4syedalihassan/workspaces-inventory/handlers"
	"github.com/4syedalihassan/workspaces-inventory/middleware"
	"github.com/gin-gonic/gin"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Initialize JWT
	middleware.InitJWT(cfg.JWTSecret)

	// Connect to PostgreSQL
	db := database.Connect(cfg.DatabaseURL)
	defer database.Close()

	// Run database migrations
	if err := database.RunMigrations(); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	// Connect to Redis
	redisClient := database.ConnectRedis(cfg.RedisURL)
	defer database.CloseRedis()

	// Initialize Gin
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()

	// Global middleware
	r.Use(middleware.Recovery())
	r.Use(middleware.Logger())
	r.Use(middleware.CORS())

	// Initialize handlers
	authHandler := &handlers.AuthHandler{DB: db}
	workspacesHandler := &handlers.WorkspacesHandler{DB: db}
	aiHandler := &handlers.AIHandler{AIServiceURL: cfg.AIServiceURL}
	syncHandler := &handlers.SyncHandler{DB: db}
	dashboardHandler := &handlers.DashboardHandler{DB: db}

	// Health check endpoint
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "healthy"})
	})

	// Public auth routes
	auth := r.Group("/auth")
	{
		auth.POST("/login", authHandler.Login)
		auth.POST("/mfa/verify", authHandler.VerifyMFA)
	}

	// Protected API routes
	api := r.Group("/api/v1")
	api.Use(middleware.JWTAuth())
	{
		// User info
		api.GET("/me", authHandler.Me)

		// Dashboard
		api.GET("/dashboard", dashboardHandler.GetStats)

		// WorkSpaces
		workspaces := api.Group("/workspaces")
		{
			workspaces.GET("", workspacesHandler.ListWorkspaces)
			workspaces.GET("/:id", workspacesHandler.GetWorkspace)
			workspaces.GET("/:id/metrics", workspacesHandler.GetWorkspaceMetrics)
			workspaces.GET("/filters/options", workspacesHandler.GetFilterOptions)
		}

		// AI
		ai := api.Group("/ai")
		{
			ai.POST("/query", aiHandler.Query)
			ai.GET("/health", aiHandler.Health)
		}

		// Sync
		sync := api.Group("/sync")
		{
			sync.POST("/trigger", syncHandler.TriggerSync)
			sync.GET("/history", syncHandler.GetSyncHistory)
		}

		// Admin routes (require ADMIN role)
		admin := api.Group("/admin")
		admin.Use(middleware.RequireRole("ADMIN"))
		{
			admin.GET("/config", func(c *gin.Context) {
				c.JSON(200, gin.H{
					"environment": cfg.Environment,
					"ai_service":  cfg.AIServiceURL,
				})
			})
		}
	}

	// Start server
	log.Printf("Server starting on port %s (environment: %s)", cfg.Port, cfg.Environment)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}

	// Suppress unused variable warning
	_ = redisClient
}
