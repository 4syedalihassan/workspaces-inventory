package handlers

import (
	"database/sql"
	"net/http"
	"strconv"

	"github.com/4syedalihassan/workspaces-inventory/models"
	"github.com/gin-gonic/gin"
)

type NotificationsHandler struct {
	DB *sql.DB
}

// ListNotifications returns notifications with filtering
func (h *NotificationsHandler) ListNotifications(c *gin.Context) {
	// Parse pagination
	limitStr := c.DefaultQuery("limit", "50")
	offsetStr := c.DefaultQuery("offset", "0")

	limit, _ := strconv.Atoi(limitStr)
	offset, _ := strconv.Atoi(offsetStr)

	// Build filters
	filters := make(map[string]interface{})

	if eventType := c.Query("event_type"); eventType != "" {
		filters["event_type"] = eventType
	}

	if workspaceID := c.Query("workspace_id"); workspaceID != "" {
		filters["workspace_id"] = workspaceID
	}

	if readStr := c.Query("read"); readStr != "" {
		if readStr == "true" {
			filters["read"] = true
		} else if readStr == "false" {
			filters["read"] = false
		}
	}

	if severity := c.Query("severity"); severity != "" {
		filters["severity"] = severity
	}

	// Get notifications
	notifications, total, err := models.ListNotifications(h.DB, filters, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve notifications"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":   notifications,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// GetUnreadCount returns count of unread notifications
func (h *NotificationsHandler) GetUnreadCount(c *gin.Context) {
	count, err := models.GetUnreadCount(h.DB)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get unread count"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"count": count})
}

// MarkAsRead marks a notification as read
func (h *NotificationsHandler) MarkAsRead(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid notification ID"})
		return
	}

	err = models.MarkNotificationAsRead(h.DB, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark notification as read"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Notification marked as read"})
}

// MarkAllAsRead marks all notifications as read
func (h *NotificationsHandler) MarkAllAsRead(c *gin.Context) {
	err := models.MarkAllNotificationsAsRead(h.DB)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark all notifications as read"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "All notifications marked as read"})
}

// DeleteNotification deletes a notification
func (h *NotificationsHandler) DeleteNotification(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid notification ID"})
		return
	}

	err = models.DeleteNotification(h.DB, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete notification"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Notification deleted"})
}

// GetPreferences returns notification preferences for the current user
func (h *NotificationsHandler) GetPreferences(c *gin.Context) {
	// Get user ID from context (set by JWT middleware)
	userIDInterface, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	userID, ok := userIDInterface.(int)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID"})
		return
	}

	prefs, err := models.GetNotificationPreferences(h.DB, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get notification preferences"})
		return
	}

	c.JSON(http.StatusOK, prefs)
}

// UpdatePreferences updates notification preferences for the current user
func (h *NotificationsHandler) UpdatePreferences(c *gin.Context) {
	// Get user ID from context
	userIDInterface, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	userID, ok := userIDInterface.(int)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID"})
		return
	}

	var prefs models.NotificationPreferences
	if err := c.ShouldBindJSON(&prefs); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	prefs.UserID = userID

	err := models.UpdateNotificationPreferences(h.DB, &prefs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update notification preferences"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Notification preferences updated"})
}
