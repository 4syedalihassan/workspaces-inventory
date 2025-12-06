package handlers

import (
	"database/sql"
	"net/http"

	"github.com/4syedalihassan/workspaces-inventory/models"
	"github.com/gin-gonic/gin"
)

type SyncHandler struct {
	DB *sql.DB
	// Add AWS services here when implemented
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

	// TODO: Implement actual AWS sync logic
	// For now, just mark as completed
	err = models.UpdateSyncHistory(h.DB, syncHistory.ID, "completed", 0, "")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update sync record"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "Sync triggered successfully",
		"sync_id":      syncHistory.ID,
		"sync_type":    syncType,
	})
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
