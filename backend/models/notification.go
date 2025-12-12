package models

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
)

// Notification represents a system notification
type Notification struct {
	ID            int             `json:"id" db:"id"`
	EventType     string          `json:"event_type" db:"event_type"`
	WorkspaceID   string          `json:"workspace_id" db:"workspace_id"`
	WorkspaceUser string          `json:"workspace_user" db:"workspace_user"`
	Title         string          `json:"title" db:"title"`
	Message       string          `json:"message" db:"message"`
	Severity      string          `json:"severity" db:"severity"` // info, warning, error, success
	Read          bool            `json:"read" db:"read"`
	CreatedAt     time.Time       `json:"created_at" db:"created_at"`
	Metadata      json.RawMessage `json:"metadata,omitempty" db:"metadata"`
}

// NotificationPreferences represents user notification settings
type NotificationPreferences struct {
	ID                   int       `json:"id" db:"id"`
	UserID               int       `json:"user_id" db:"user_id"`
	EmailEnabled         bool      `json:"email_enabled" db:"email_enabled"`
	NotifyOnCreate       bool      `json:"notify_on_create" db:"notify_on_create"`
	NotifyOnTerminate    bool      `json:"notify_on_terminate" db:"notify_on_terminate"`
	NotifyOnModify       bool      `json:"notify_on_modify" db:"notify_on_modify"`
	NotifyOnStateChange  bool      `json:"notify_on_state_change" db:"notify_on_state_change"`
	CreatedAt            time.Time `json:"created_at" db:"created_at"`
	UpdatedAt            time.Time `json:"updated_at" db:"updated_at"`
}

// Event type constants
const (
	EventWorkspaceCreated    = "workspace_created"
	EventWorkspaceTerminated = "workspace_terminated"
	EventWorkspaceModified   = "workspace_modified"
	EventWorkspaceStateChange = "workspace_state_change"
	EventSyncCompleted       = "sync_completed"
	EventSyncFailed          = "sync_failed"
)

// Severity constants
const (
	SeverityInfo    = "info"
	SeverityWarning = "warning"
	SeverityError   = "error"
	SeveritySuccess = "success"
)

// CreateNotification inserts a new notification
func CreateNotification(db *sql.DB, notification *Notification) error {
	query := `
		INSERT INTO notifications (event_type, workspace_id, workspace_user, title, message, severity, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at
	`

	err := db.QueryRow(query,
		notification.EventType,
		notification.WorkspaceID,
		notification.WorkspaceUser,
		notification.Title,
		notification.Message,
		notification.Severity,
		notification.Metadata,
	).Scan(&notification.ID, &notification.CreatedAt)

	return err
}

// ListNotifications retrieves notifications with filtering
func ListNotifications(db *sql.DB, filters map[string]interface{}, limit, offset int) ([]Notification, int, error) {
	baseQuery := `
		SELECT id, event_type, workspace_id, workspace_user, title, message, severity, read, created_at, metadata
		FROM notifications
		WHERE 1=1
	`

	countQuery := "SELECT COUNT(*) FROM notifications WHERE 1=1"
	args := []interface{}{}
	argPos := 1

	// Apply filters
	if eventType, ok := filters["event_type"].(string); ok && eventType != "" {
		filterClause := fmt.Sprintf(" AND event_type = $%d", argPos)
		baseQuery += filterClause
		countQuery += filterClause
		args = append(args, eventType)
		argPos++
	}

	if workspaceID, ok := filters["workspace_id"].(string); ok && workspaceID != "" {
		filterClause := fmt.Sprintf(" AND workspace_id = $%d", argPos)
		baseQuery += filterClause
		countQuery += filterClause
		args = append(args, workspaceID)
		argPos++
	}

	if read, ok := filters["read"].(bool); ok {
		filterClause := fmt.Sprintf(" AND read = $%d", argPos)
		baseQuery += filterClause
		countQuery += filterClause
		args = append(args, read)
		argPos++
	}

	if severity, ok := filters["severity"].(string); ok && severity != "" {
		filterClause := fmt.Sprintf(" AND severity = $%d", argPos)
		baseQuery += filterClause
		countQuery += filterClause
		args = append(args, severity)
		argPos++
	}

	// Get total count
	var total int
	err := db.QueryRow(countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Add pagination
	baseQuery += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argPos, argPos+1)
	args = append(args, limit, offset)

	rows, err := db.Query(baseQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	notifications := []Notification{}
	for rows.Next() {
		var n Notification
		err := rows.Scan(&n.ID, &n.EventType, &n.WorkspaceID, &n.WorkspaceUser,
			&n.Title, &n.Message, &n.Severity, &n.Read, &n.CreatedAt, &n.Metadata)
		if err != nil {
			return nil, 0, err
		}
		notifications = append(notifications, n)
	}

	return notifications, total, nil
}

// MarkNotificationAsRead marks a notification as read
func MarkNotificationAsRead(db *sql.DB, id int) error {
	query := "UPDATE notifications SET read = true WHERE id = $1"
	_, err := db.Exec(query, id)
	return err
}

// MarkAllNotificationsAsRead marks all notifications as read
func MarkAllNotificationsAsRead(db *sql.DB) error {
	query := "UPDATE notifications SET read = true WHERE read = false"
	_, err := db.Exec(query)
	return err
}

// DeleteNotification deletes a notification by ID
func DeleteNotification(db *sql.DB, id int) error {
	query := "DELETE FROM notifications WHERE id = $1"
	_, err := db.Exec(query, id)
	return err
}

// GetUnreadCount gets count of unread notifications
func GetUnreadCount(db *sql.DB) (int, error) {
	query := "SELECT COUNT(*) FROM notifications WHERE read = false"
	var count int
	err := db.QueryRow(query).Scan(&count)
	return count, err
}

// GetNotificationPreferences retrieves user notification preferences
func GetNotificationPreferences(db *sql.DB, userID int) (*NotificationPreferences, error) {
	query := `
		SELECT id, user_id, email_enabled, notify_on_create, notify_on_terminate,
		       notify_on_modify, notify_on_state_change, created_at, updated_at
		FROM notification_preferences
		WHERE user_id = $1
	`

	var prefs NotificationPreferences
	err := db.QueryRow(query, userID).Scan(
		&prefs.ID, &prefs.UserID, &prefs.EmailEnabled, &prefs.NotifyOnCreate,
		&prefs.NotifyOnTerminate, &prefs.NotifyOnModify, &prefs.NotifyOnStateChange,
		&prefs.CreatedAt, &prefs.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		// Create default preferences
		return CreateDefaultNotificationPreferences(db, userID)
	}

	return &prefs, err
}

// CreateDefaultNotificationPreferences creates default preferences for a user
func CreateDefaultNotificationPreferences(db *sql.DB, userID int) (*NotificationPreferences, error) {
	query := `
		INSERT INTO notification_preferences (user_id, email_enabled, notify_on_create, notify_on_terminate, notify_on_modify, notify_on_state_change)
		VALUES ($1, true, true, true, true, true)
		RETURNING id, user_id, email_enabled, notify_on_create, notify_on_terminate, notify_on_modify, notify_on_state_change, created_at, updated_at
	`

	var prefs NotificationPreferences
	err := db.QueryRow(query, userID).Scan(
		&prefs.ID, &prefs.UserID, &prefs.EmailEnabled, &prefs.NotifyOnCreate,
		&prefs.NotifyOnTerminate, &prefs.NotifyOnModify, &prefs.NotifyOnStateChange,
		&prefs.CreatedAt, &prefs.UpdatedAt,
	)

	return &prefs, err
}

// UpdateNotificationPreferences updates user preferences
func UpdateNotificationPreferences(db *sql.DB, prefs *NotificationPreferences) error {
	query := `
		UPDATE notification_preferences
		SET email_enabled = $1, notify_on_create = $2, notify_on_terminate = $3,
		    notify_on_modify = $4, notify_on_state_change = $5, updated_at = CURRENT_TIMESTAMP
		WHERE user_id = $6
	`

	_, err := db.Exec(query,
		prefs.EmailEnabled, prefs.NotifyOnCreate, prefs.NotifyOnTerminate,
		prefs.NotifyOnModify, prefs.NotifyOnStateChange, prefs.UserID,
	)

	return err
}

// DeleteOldNotifications deletes notifications older than the specified duration
func DeleteOldNotifications(db *sql.DB, olderThan time.Duration) (int64, error) {
	query := "DELETE FROM notifications WHERE created_at < $1"
	threshold := time.Now().Add(-olderThan)

	result, err := db.Exec(query, threshold)
	if err != nil {
		return 0, err
	}

	return result.RowsAffected()
}
