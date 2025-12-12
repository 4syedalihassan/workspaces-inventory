package services

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/smtp"

	"github.com/4syedalihassan/workspaces-inventory/models"
)

type NotificationService struct {
	DB *sql.DB
}

// NotifyWorkspaceCreated sends notification when a workspace is created
func (s *NotificationService) NotifyWorkspaceCreated(workspaceID, userName, adFullName string) error {
	displayName := userName
	if adFullName != "" {
		displayName = adFullName
	}

	metadata, _ := json.Marshal(map[string]string{
		"workspace_id": workspaceID,
		"user_name":    userName,
		"full_name":    displayName,
	})

	notification := &models.Notification{
		EventType:     models.EventWorkspaceCreated,
		WorkspaceID:   workspaceID,
		WorkspaceUser: userName,
		Title:         "New WorkSpace Created",
		Message:       fmt.Sprintf("WorkSpace %s has been created for user %s", workspaceID, displayName),
		Severity:      models.SeverityInfo,
		Metadata:      metadata,
	}

	if err := models.CreateNotification(s.DB, notification); err != nil {
		log.Printf("Failed to create notification: %v", err)
		return err
	}

	// Send email notification if enabled
	s.sendEmailNotification(notification)

	log.Printf("Notification created: WorkSpace %s created for %s", workspaceID, displayName)
	return nil
}

// NotifyWorkspaceTerminated sends notification when a workspace is terminated
func (s *NotificationService) NotifyWorkspaceTerminated(workspaceID, userName, adFullName string) error {
	displayName := userName
	if adFullName != "" {
		displayName = adFullName
	}

	metadata, _ := json.Marshal(map[string]string{
		"workspace_id": workspaceID,
		"user_name":    userName,
		"full_name":    displayName,
	})

	notification := &models.Notification{
		EventType:     models.EventWorkspaceTerminated,
		WorkspaceID:   workspaceID,
		WorkspaceUser: userName,
		Title:         "WorkSpace Terminated",
		Message:       fmt.Sprintf("WorkSpace %s for user %s has been terminated", workspaceID, displayName),
		Severity:      models.SeverityWarning,
		Metadata:      metadata,
	}

	if err := models.CreateNotification(s.DB, notification); err != nil {
		log.Printf("Failed to create notification: %v", err)
		return err
	}

	// Send email notification if enabled
	s.sendEmailNotification(notification)

	log.Printf("Notification created: WorkSpace %s terminated for %s", workspaceID, displayName)
	return nil
}

// NotifyWorkspaceModified sends notification when a workspace is modified
func (s *NotificationService) NotifyWorkspaceModified(workspaceID, userName, adFullName, changeDescription string) error {
	displayName := userName
	if adFullName != "" {
		displayName = adFullName
	}

	metadata, _ := json.Marshal(map[string]string{
		"workspace_id": workspaceID,
		"user_name":    userName,
		"full_name":    displayName,
		"change":       changeDescription,
	})

	notification := &models.Notification{
		EventType:     models.EventWorkspaceModified,
		WorkspaceID:   workspaceID,
		WorkspaceUser: userName,
		Title:         "WorkSpace Modified",
		Message:       fmt.Sprintf("WorkSpace %s for user %s has been modified: %s", workspaceID, displayName, changeDescription),
		Severity:      models.SeverityInfo,
		Metadata:      metadata,
	}

	if err := models.CreateNotification(s.DB, notification); err != nil {
		log.Printf("Failed to create notification: %v", err)
		return err
	}

	// Send email notification if enabled
	s.sendEmailNotification(notification)

	log.Printf("Notification created: WorkSpace %s modified for %s", workspaceID, displayName)
	return nil
}

// NotifyWorkspaceStateChange sends notification when workspace state changes
func (s *NotificationService) NotifyWorkspaceStateChange(workspaceID, userName, adFullName, oldState, newState string) error {
	displayName := userName
	if adFullName != "" {
		displayName = adFullName
	}

	metadata, _ := json.Marshal(map[string]string{
		"workspace_id": workspaceID,
		"user_name":    userName,
		"full_name":    displayName,
		"old_state":    oldState,
		"new_state":    newState,
	})

	severity := models.SeverityInfo
	if newState == "TERMINATED" || newState == "ERROR" {
		severity = models.SeverityWarning
	}

	notification := &models.Notification{
		EventType:     models.EventWorkspaceStateChange,
		WorkspaceID:   workspaceID,
		WorkspaceUser: userName,
		Title:         "WorkSpace State Changed",
		Message:       fmt.Sprintf("WorkSpace %s for user %s changed from %s to %s", workspaceID, displayName, oldState, newState),
		Severity:      severity,
		Metadata:      metadata,
	}

	if err := models.CreateNotification(s.DB, notification); err != nil {
		log.Printf("Failed to create notification: %v", err)
		return err
	}

	// Send email notification if enabled
	s.sendEmailNotification(notification)

	log.Printf("Notification created: WorkSpace %s state changed from %s to %s", workspaceID, oldState, newState)
	return nil
}

// NotifySyncCompleted sends notification when a sync completes successfully
func (s *NotificationService) NotifySyncCompleted(syncType string, recordsProcessed int) error {
	metadata, _ := json.Marshal(map[string]interface{}{
		"sync_type":        syncType,
		"records_processed": recordsProcessed,
	})

	notification := &models.Notification{
		EventType:     models.EventSyncCompleted,
		WorkspaceID:   "",
		WorkspaceUser: "",
		Title:         "Sync Completed",
		Message:       fmt.Sprintf("Sync of type '%s' completed successfully. Processed %d records.", syncType, recordsProcessed),
		Severity:      models.SeveritySuccess,
		Metadata:      metadata,
	}

	if err := models.CreateNotification(s.DB, notification); err != nil {
		log.Printf("Failed to create notification: %v", err)
		return err
	}

	log.Printf("Notification created: Sync %s completed with %d records", syncType, recordsProcessed)
	return nil
}

// NotifySyncFailed sends notification when a sync fails
func (s *NotificationService) NotifySyncFailed(syncType, errorMessage string) error {
	metadata, _ := json.Marshal(map[string]interface{}{
		"sync_type": syncType,
		"error":     errorMessage,
	})

	notification := &models.Notification{
		EventType:     models.EventSyncFailed,
		WorkspaceID:   "",
		WorkspaceUser: "",
		Title:         "Sync Failed",
		Message:       fmt.Sprintf("Sync of type '%s' failed: %s", syncType, errorMessage),
		Severity:      models.SeverityError,
		Metadata:      metadata,
	}

	if err := models.CreateNotification(s.DB, notification); err != nil {
		log.Printf("Failed to create notification: %v", err)
		return err
	}

	log.Printf("Notification created: Sync %s failed", syncType)
	return nil
}

// sendEmailNotification sends an email notification if configured
func (s *NotificationService) sendEmailNotification(notification *models.Notification) {
	// Check if email notifications are enabled
	emailEnabled, err := models.GetSetting(s.DB, "notifications.email_enabled")
	if err != nil || emailEnabled.Value != "true" {
		return
	}

	// Get SMTP settings
	smtpHost, err := models.GetSetting(s.DB, "notifications.smtp_host")
	if err != nil || smtpHost.Value == "" {
		return
	}

	smtpPort, err := models.GetSetting(s.DB, "notifications.smtp_port")
	if err != nil || smtpPort.Value == "" {
		smtpPort.Value = "587"
	}

	smtpUsername, err := models.GetSetting(s.DB, "notifications.smtp_username")
	if err != nil || smtpUsername.Value == "" {
		return
	}

	smtpPassword, err := models.GetSetting(s.DB, "notifications.smtp_password")
	if err != nil || smtpPassword.Value == "" {
		return
	}

	fromEmail, err := models.GetSetting(s.DB, "notifications.from_email")
	if err != nil || fromEmail.Value == "" {
		return
	}

	// Get admin emails (users with ADMIN role)
	query := "SELECT email FROM users WHERE role = 'ADMIN' AND email IS NOT NULL AND email != ''"
	rows, err := s.DB.Query(query)
	if err != nil {
		log.Printf("Failed to get admin emails: %v", err)
		return
	}
	defer rows.Close()

	recipients := []string{}
	for rows.Next() {
		var email string
		if err := rows.Scan(&email); err == nil {
			recipients = append(recipients, email)
		}
	}

	if len(recipients) == 0 {
		return
	}

	// Compose email
	subject := notification.Title
	body := fmt.Sprintf(`
<html>
<body>
<h2>%s</h2>
<p>%s</p>
<hr>
<p><strong>Event Type:</strong> %s</p>
<p><strong>Severity:</strong> %s</p>
<p><strong>Time:</strong> %s</p>
</body>
</html>
	`, notification.Title, notification.Message, notification.EventType, notification.Severity, notification.CreatedAt.Format("2006-01-02 15:04:05"))

	// Send email to each recipient
	for _, recipient := range recipients {
		msg := []byte(fmt.Sprintf("To: %s\r\n"+
			"From: %s\r\n"+
			"Subject: %s\r\n"+
			"MIME-Version: 1.0\r\n"+
			"Content-Type: text/html; charset=UTF-8\r\n"+
			"\r\n"+
			"%s\r\n", recipient, fromEmail.Value, subject, body))

		// Setup authentication
		auth := smtp.PlainAuth("", smtpUsername.Value, smtpPassword.Value, smtpHost.Value)

		// Send email
		addr := fmt.Sprintf("%s:%s", smtpHost.Value, smtpPort.Value)
		err := smtp.SendMail(addr, auth, fromEmail.Value, []string{recipient}, msg)
		if err != nil {
			log.Printf("Failed to send email to %s: %v", recipient, err)
		} else {
			log.Printf("Email notification sent to %s", recipient)
		}
	}
}

// DetectWorkspaceChanges detects changes between old and new workspace states
func (s *NotificationService) DetectWorkspaceChanges(oldState, newState map[string]interface{}) []string {
	changes := []string{}

	// Compare key fields
	if oldState["state"] != newState["state"] {
		changes = append(changes, fmt.Sprintf("State changed from %v to %v", oldState["state"], newState["state"]))
	}

	if oldState["running_mode"] != newState["running_mode"] {
		changes = append(changes, fmt.Sprintf("Running mode changed from %v to %v", oldState["running_mode"], newState["running_mode"]))
	}

	if oldState["compute_type_name"] != newState["compute_type_name"] {
		changes = append(changes, fmt.Sprintf("Compute type changed from %v to %v", oldState["compute_type_name"], newState["compute_type_name"]))
	}

	return changes
}
