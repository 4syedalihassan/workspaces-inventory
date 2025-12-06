package handlers

import (
	"database/sql"
	"net/http"

	"github.com/4syedalihassan/workspaces-inventory/models"
	"github.com/gin-gonic/gin"
)

type DashboardHandler struct {
	DB *sql.DB
}

type DashboardStats struct {
	TotalWorkspaces     int     `json:"total_workspaces"`
	ActiveWorkspaces    int     `json:"active_workspaces"`
	StoppedWorkspaces   int     `json:"stopped_workspaces"`
	TerminatedWorkspaces int    `json:"terminated_workspaces"`
	TotalMonthlyCost    float64 `json:"total_monthly_cost"`
	RecentActivity      []models.SyncHistory `json:"recent_activity"`
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

	// Get recent activity
	history, _ := models.ListSyncHistory(h.DB, 10)
	stats.RecentActivity = history

	c.JSON(http.StatusOK, stats)
}
