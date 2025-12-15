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
	adminHandler := &handlers.AdminHandler{DB: db}
	usageHandler := &handlers.UsageHandler{DB: db}
	billingHandler := &handlers.BillingHandler{DB: db}
	cloudtrailHandler := &handlers.CloudTrailHandler{DB: db}
	notificationsHandler := &handlers.NotificationsHandler{DB: db}
	awsAccountHandler := &handlers.AWSAccountHandler{DB: db}
	ldapServerHandler := &handlers.LDAPServerHandler{DB: db}

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
			workspaces.GET("/export", workspacesHandler.ExportWorkspaces)
		}

		// Usage
		usage := api.Group("/usage")
		{
			usage.GET("", usageHandler.ListUsage)
			usage.GET("/summary", usageHandler.GetUsageSummary)
			usage.GET("/export", usageHandler.ExportUsage)
		}

		// Billing
		billing := api.Group("/billing")
		{
			billing.GET("", billingHandler.ListBilling)
			billing.GET("/export", billingHandler.ExportBilling)
		}

		// CloudTrail
		cloudtrail := api.Group("/cloudtrail")
		{
			cloudtrail.GET("", cloudtrailHandler.ListEvents)
			cloudtrail.GET("/:id", cloudtrailHandler.GetEvent)
			cloudtrail.GET("/export", cloudtrailHandler.ExportCloudTrail)
		}

		// Notifications
		notifications := api.Group("/notifications")
		{
			notifications.GET("", notificationsHandler.ListNotifications)
			notifications.GET("/unread/count", notificationsHandler.GetUnreadCount)
			notifications.PUT("/:id/read", notificationsHandler.MarkAsRead)
			notifications.PUT("/read-all", notificationsHandler.MarkAllAsRead)
			notifications.DELETE("/:id", notificationsHandler.DeleteNotification)
			notifications.GET("/preferences", notificationsHandler.GetPreferences)
			notifications.PUT("/preferences", notificationsHandler.UpdatePreferences)
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
			// Settings management
			admin.GET("/settings", adminHandler.GetSettings)
			admin.GET("/settings/:key", adminHandler.GetSetting)
			admin.PUT("/settings/:key", adminHandler.UpdateSetting)
			admin.PUT("/settings", adminHandler.UpdateBulkSettings)

			// User management
			admin.GET("/users", adminHandler.ListUsers)
			admin.POST("/users", adminHandler.CreateUser)
			admin.PUT("/users/:id", adminHandler.UpdateUser)
			admin.DELETE("/users/:id", adminHandler.DeleteUser)

			// AWS Account management
			admin.GET("/aws-accounts", awsAccountHandler.ListAWSAccounts)
			admin.GET("/aws-accounts/:id", awsAccountHandler.GetAWSAccount)
			admin.POST("/aws-accounts", awsAccountHandler.CreateAWSAccount)
			admin.PUT("/aws-accounts/:id", awsAccountHandler.UpdateAWSAccount)
			admin.DELETE("/aws-accounts/:id", awsAccountHandler.DeleteAWSAccount)
			admin.GET("/aws-accounts/:id/test", awsAccountHandler.TestAWSConnection)
			admin.POST("/aws-accounts/:id/sync", awsAccountHandler.SyncAWSAccount)

			// LDAP Server management
			admin.GET("/ldap-servers", ldapServerHandler.ListLDAPServers)
			admin.GET("/ldap-servers/:id", ldapServerHandler.GetLDAPServer)
			admin.POST("/ldap-servers", ldapServerHandler.CreateLDAPServer)
			admin.PUT("/ldap-servers/:id", ldapServerHandler.UpdateLDAPServer)
			admin.DELETE("/ldap-servers/:id", ldapServerHandler.DeleteLDAPServer)
			admin.GET("/ldap-servers/:id/test", ldapServerHandler.TestLDAPConnection)
			admin.POST("/ldap-servers/:id/sync", ldapServerHandler.SyncLDAPServer)

			// Integration tests (legacy)
			admin.POST("/test/aws", adminHandler.TestAWSConnection)

			// Legacy config endpoint
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
