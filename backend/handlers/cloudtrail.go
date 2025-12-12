package handlers

import (
	"database/sql"
	"net/http"
	"strconv"

	"github.com/4syedalihassan/workspaces-inventory/models"
	"github.com/gin-gonic/gin"
)

type CloudTrailHandler struct {
	DB *sql.DB
}

// ListEvents returns CloudTrail events with filtering
func (h *CloudTrailHandler) ListEvents(c *gin.Context) {
	// Parse pagination
	limitStr := c.DefaultQuery("limit", "50")
	offsetStr := c.DefaultQuery("offset", "0")

	limit, _ := strconv.Atoi(limitStr)
	offset, _ := strconv.Atoi(offsetStr)

	// Build filters
	filters := make(map[string]interface{})

	if workspaceID := c.Query("workspace_id"); workspaceID != "" {
		filters["workspace_id"] = workspaceID
	}

	if eventName := c.Query("event_name"); eventName != "" {
		filters["event_name"] = eventName
	}

	if username := c.Query("username"); username != "" {
		filters["username"] = username
	}

	if startTime := c.Query("start_time"); startTime != "" {
		filters["start_time"] = startTime
	}

	if endTime := c.Query("end_time"); endTime != "" {
		filters["end_time"] = endTime
	}

	// Get CloudTrail events
	events, total, err := models.ListCloudTrailEvents(h.DB, filters, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve CloudTrail events"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":   events,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// GetEvent returns a single CloudTrail event by ID
func (h *CloudTrailHandler) GetEvent(c *gin.Context) {
	eventIDStr := c.Param("id")

	query := `
		SELECT id, event_id, event_name, event_time, event_source, username,
		       user_identity, workspace_id, request_parameters, response_elements,
		       event_region, created_at
		FROM cloudtrail_events
		WHERE id = $1
	`

	var event models.CloudTrailEvent
	err := h.DB.QueryRow(query, eventIDStr).Scan(
		&event.ID, &event.EventID, &event.EventName, &event.EventTime, &event.EventSource,
		&event.Username, &event.UserIdentity, &event.WorkspaceID, &event.RequestParameters,
		&event.ResponseElements, &event.EventRegion, &event.CreatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Event not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve event"})
		return
	}

	c.JSON(http.StatusOK, event)
}

// ExportCloudTrail exports CloudTrail events to CSV or Excel
func (h *CloudTrailHandler) ExportCloudTrail(c *gin.Context) {
	format := c.DefaultQuery("format", "xlsx")

	// Build filters
	filters := make(map[string]interface{})

	if workspaceID := c.Query("workspace_id"); workspaceID != "" {
		filters["workspace_id"] = workspaceID
	}

	if eventName := c.Query("event_name"); eventName != "" {
		filters["event_name"] = eventName
	}

	if username := c.Query("username"); username != "" {
		filters["username"] = username
	}

	if startTime := c.Query("start_time"); startTime != "" {
		filters["start_time"] = startTime
	}

	if endTime := c.Query("end_time"); endTime != "" {
		filters["end_time"] = endTime
	}

	// Get all events (no pagination for export)
	events, _, err := models.ListCloudTrailEvents(h.DB, filters, 10000, 0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve CloudTrail events"})
		return
	}

	// Export using the export handler
	ExportData(c, events, format, "cloudtrail")
}
