package handlers

import (
	"database/sql"
	"log"
	"net/http"
	"time"

	"github.com/4syedalihassan/workspaces-inventory/models"
	"github.com/gin-gonic/gin"
)

type DashboardHandler struct {
	DB *sql.DB
}

type DashboardStats struct {
	TotalWorkspaces      int                    `json:"total_workspaces"`
	ActiveWorkspaces     int                    `json:"active_workspaces"`
	StoppedWorkspaces    int                    `json:"stopped_workspaces"`
	TerminatedWorkspaces int                    `json:"terminated_workspaces"`
	TotalMonthlyCost     float64                `json:"total_monthly_cost"`
	CurrentMonthUsage    map[string]interface{} `json:"current_month_usage"`
	LastSync             *string                `json:"last_sync,omitempty"`
	RecentActivity       []models.SyncHistory   `json:"recent_activity"`
}

// GetStats returns dashboard statistics
func (h *DashboardHandler) GetStats(c *gin.Context) {
	var stats DashboardStats

	// Get total workspaces
	h.DB.QueryRow("SELECT COUNT(*) FROM workspaces").Scan(&stats.TotalWorkspaces)

	// Get workspaces by state
	h.DB.QueryRow("SELECT COUNT(*) FROM workspaces WHERE state = 'AVAILABLE'").Scan(&stats.ActiveWorkspaces)
	h.DB.QueryRow("SELECT COUNT(*) FROM workspaces WHERE state = 'STOPPED'").Scan(&stats.StoppedWorkspaces)
	h.DB.QueryRow("SELECT COUNT(*) FROM workspaces WHERE state = 'TERMINATED'").Scan(&stats.TerminatedWorkspaces)

	// Get total monthly cost (current month)
	h.DB.QueryRow(`
		SELECT COALESCE(SUM(amount), 0)
		FROM billing_data
		WHERE start_date >= DATE_TRUNC('month', CURRENT_DATE)
	`).Scan(&stats.TotalMonthlyCost)

	// Get current month usage statistics
	currentMonth := getCurrentYearMonth()
	usageSummary, err := models.GetMonthlyUsageSummary(h.DB, currentMonth)
	if err != nil {
		// Log error for debugging data quality or connectivity issues
		log.Printf("Failed to load monthly usage summary for %s: %v", currentMonth, err)
		// If there's an error, return empty usage stats with all expected fields
		stats.CurrentMonthUsage = map[string]interface{}{
			"workspace_count": 0,
			"total_hours":     0.0,
			"avg_hours":       0.0,
			"max_hours":       0.0,
			"min_hours":       0.0,
		}
	} else {
		stats.CurrentMonthUsage = usageSummary
	}

	// Get last sync timestamp
	var lastSyncTime sql.NullString
	err = h.DB.QueryRow(`
		SELECT TO_CHAR(completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
		FROM sync_history
		WHERE status = 'completed'
		ORDER BY completed_at DESC
		LIMIT 1
	`).Scan(&lastSyncTime)
	// Only set LastSync if query succeeds and value is valid
	if err == nil && lastSyncTime.Valid {
		stats.LastSync = &lastSyncTime.String
	}

	// Get recent activity
	history, err := models.ListSyncHistory(h.DB, 10)
	if err != nil {
		// If there's an error, return empty history
		stats.RecentActivity = []models.SyncHistory{}
	} else {
		stats.RecentActivity = history
	}

	c.JSON(http.StatusOK, stats)
}

// getCurrentYearMonth returns the current year-month in YYYY-MM format
func getCurrentYearMonth() string {
	now := time.Now()
	return now.Format("2006-01")
}
