package handlers

import (
	"database/sql"
	"net/http"

	"github.com/4syedalihassan/workspaces-inventory/models"
	"github.com/gin-gonic/gin"
)

type UsageHandler struct {
	DB *sql.DB
}

// ListUsage returns workspace usage data with filtering and pagination
func (h *UsageHandler) ListUsage(c *gin.Context) {
	// Parse pagination
	limit, offset := models.ParsePagination(c.Request.URL.Query())

	// Build filters from query parameters
	filters := models.BuildUsageFilters(c.Request.URL.Query())

	// Get usage data
	usage, total, err := models.ListWorkspaceUsage(h.DB, filters, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve usage data"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":   usage,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// GetUsageSummary returns monthly usage summary
func (h *UsageHandler) GetUsageSummary(c *gin.Context) {
	month := c.Query("month")
	if month == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "month parameter is required"})
		return
	}

	summary, err := models.GetMonthlyUsageSummary(h.DB, month)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve usage summary"})
		return
	}

	c.JSON(http.StatusOK, summary)
}

// ExportUsage exports usage data to CSV or Excel
func (h *UsageHandler) ExportUsage(c *gin.Context) {
	format := c.DefaultQuery("format", "csv")

	// Build filters from query parameters
	filters := models.BuildUsageFilters(c.Request.URL.Query())

	// Get all usage data (no pagination for export)
	usage, _, err := models.ListWorkspaceUsage(h.DB, filters, 10000, 0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve usage data"})
		return
	}

	// Export using the export handler
	ExportData(c, usage, format, "usage")
}
