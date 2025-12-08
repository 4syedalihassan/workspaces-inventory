package handlers

import (
	"context"
	"database/sql"
	"net/http"
	"time"

	"github.com/4syedalihassan/workspaces-inventory/models"
	"github.com/4syedalihassan/workspaces-inventory/services"
	"github.com/gin-gonic/gin"
)

type SyncHandler struct {
	DB *sql.DB
}

// TriggerSync triggers a manual sync of all data sources
func (h *SyncHandler) TriggerSync(c *gin.Context) {
	syncType := c.DefaultQuery("type", "all")

	// Create sync history record
	syncHistory, err := models.CreateSyncHistory(h.DB, syncType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create sync record"})
		return
	}

	// Run sync asynchronously
	go h.runSync(syncHistory.ID, syncType)

	c.JSON(http.StatusAccepted, gin.H{
		"message":   "Sync started",
		"sync_id":   syncHistory.ID,
		"sync_type": syncType,
	})
}

// runSync performs the actual sync operation
func (h *SyncHandler) runSync(syncID int, syncType string) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	awsService := &services.AWSService{DB: h.DB}

	var recordsProcessed int
	var err error

	switch syncType {
	case "workspaces", "all":
		recordsProcessed, err = awsService.SyncWorkSpaces(ctx)
	default:
		err = nil
		recordsProcessed = 0
	}

	// Update sync history
	status := "completed"
	errorMsg := ""
	if err != nil {
		status = "failed"
		errorMsg = err.Error()
	}

	models.UpdateSyncHistory(h.DB, syncID, status, recordsProcessed, errorMsg)
}

// GetSyncHistory returns sync history records
func (h *SyncHandler) GetSyncHistory(c *gin.Context) {
	history, err := models.ListSyncHistory(h.DB, 50)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve sync history"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": history})
}
