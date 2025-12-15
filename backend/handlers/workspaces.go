package handlers

import (
	"database/sql"
	"net/http"
	"strconv"

	"github.com/4syedalihassan/workspaces-inventory/models"
	"github.com/gin-gonic/gin"
)

type WorkspacesHandler struct {
	DB *sql.DB
}

// ListWorkspaces returns a list of workspaces with filtering and pagination
func (h *WorkspacesHandler) ListWorkspaces(c *gin.Context) {
	// Parse query parameters
	limitStr := c.DefaultQuery("limit", "20")
	offsetStr := c.DefaultQuery("offset", "0")

	limit, _ := strconv.Atoi(limitStr)
	offset, _ := strconv.Atoi(offsetStr)

	// Build filters
	filters := make(map[string]interface{})
	if userName := c.Query("user_name"); userName != "" {
		filters["user_name"] = userName
	}
	if state := c.Query("state"); state != "" {
		filters["state"] = state
	}

	// Get workspaces
	workspaces, total, err := models.ListWorkspaces(h.DB, filters, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve workspaces"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":   workspaces,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// GetWorkspace returns a single workspace by ID
func (h *WorkspacesHandler) GetWorkspace(c *gin.Context) {
	workspaceID := c.Param("id")

	workspace, err := models.GetWorkspaceByID(h.DB, workspaceID)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve workspace"})
		return
	}

	c.JSON(http.StatusOK, workspace)
}

// GetWorkspaceMetrics returns usage and billing data for a workspace
func (h *WorkspacesHandler) GetWorkspaceMetrics(c *gin.Context) {
	workspaceID := c.Param("id")

	// Get usage data
	usageFilters := map[string]interface{}{"workspace_id": workspaceID}
	// TODO: Implement GetWorkspaceUsage function
	// usage, err := models.GetWorkspaceUsage(h.DB, workspaceID)

	// Get billing data
	billingData, _, err := models.ListBillingData(h.DB, usageFilters, 100, 0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve metrics"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"workspace_id": workspaceID,
		"billing":      billingData,
	})
}

// GetFilterOptions returns available filter values
func (h *WorkspacesHandler) GetFilterOptions(c *gin.Context) {
	// Get distinct states
	statesQuery := "SELECT DISTINCT state FROM workspaces WHERE state IS NOT NULL ORDER BY state"
	stateRows, _ := h.DB.Query(statesQuery)
	defer stateRows.Close()

	states := []string{}
	for stateRows.Next() {
		var state string
		stateRows.Scan(&state)
		states = append(states, state)
	}

	// Get distinct running modes
	modesQuery := "SELECT DISTINCT running_mode FROM workspaces WHERE running_mode IS NOT NULL ORDER BY running_mode"
	modeRows, _ := h.DB.Query(modesQuery)
	defer modeRows.Close()

	modes := []string{}
	for modeRows.Next() {
		var mode string
		modeRows.Scan(&mode)
		modes = append(modes, mode)
	}

	c.JSON(http.StatusOK, gin.H{
		"states":       states,
		"runningModes": modes,
	})
}
