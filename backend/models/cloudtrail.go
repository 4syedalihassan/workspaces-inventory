package models

import (
	"database/sql"
	"encoding/json"
	"time"
)

// CloudTrailEvent represents an AWS CloudTrail event
type CloudTrailEvent struct {
	ID                 int             `json:"id" db:"id"`
	EventID            string          `json:"event_id" db:"event_id"`
	EventName          string          `json:"event_name" db:"event_name"`
	EventTime          time.Time       `json:"event_time" db:"event_time"`
	EventSource        string          `json:"event_source" db:"event_source"`
	Username           string          `json:"username" db:"username"`
	UserIdentity       json.RawMessage `json:"user_identity" db:"user_identity"`
	WorkspaceID        string          `json:"workspace_id" db:"workspace_id"`
	RequestParameters  json.RawMessage `json:"request_parameters" db:"request_parameters"`
	ResponseElements   json.RawMessage `json:"response_elements" db:"response_elements"`
	EventRegion        string          `json:"event_region" db:"event_region"`
	CreatedAt          time.Time       `json:"created_at" db:"created_at"`
}

// ListCloudTrailEvents retrieves CloudTrail events with filtering
func ListCloudTrailEvents(db *sql.DB, filters map[string]interface{}, limit, offset int) ([]CloudTrailEvent, int, error) {
	baseQuery := `
		SELECT id, event_id, event_name, event_time, event_source, username,
		       user_identity, workspace_id, request_parameters, response_elements,
		       event_region, created_at
		FROM cloudtrail_events
		WHERE 1=1
	`

	countQuery := "SELECT COUNT(*) FROM cloudtrail_events WHERE 1=1"
	args := []interface{}{}
	argPos := 1

	// Apply filters
	if workspaceID, ok := filters["workspace_id"].(string); ok && workspaceID != "" {
		baseQuery += " AND workspace_id = $" + string(rune(argPos+'0'))
		countQuery += " AND workspace_id = $" + string(rune(argPos+'0'))
		args = append(args, workspaceID)
		argPos++
	}

	// Get total count
	var total int
	err := db.QueryRow(countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Add pagination
	baseQuery += " ORDER BY event_time DESC LIMIT $" + string(rune(argPos+'0')) + " OFFSET $" + string(rune(argPos+1+'0'))
	args = append(args, limit, offset)

	rows, err := db.Query(baseQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	events := []CloudTrailEvent{}
	for rows.Next() {
		var evt CloudTrailEvent
		err := rows.Scan(
			&evt.ID, &evt.EventID, &evt.EventName, &evt.EventTime, &evt.EventSource,
			&evt.Username, &evt.UserIdentity, &evt.WorkspaceID, &evt.RequestParameters,
			&evt.ResponseElements, &evt.EventRegion, &evt.CreatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		events = append(events, evt)
	}

	return events, total, nil
}

// InsertCloudTrailEvent inserts a new CloudTrail event
func InsertCloudTrailEvent(db *sql.DB, event *CloudTrailEvent) error {
	query := `
		INSERT INTO cloudtrail_events (
			event_id, event_name, event_time, event_source, username,
			user_identity, workspace_id, request_parameters, response_elements,
			event_region
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (event_id) DO NOTHING
	`

	_, err := db.Exec(query,
		event.EventID, event.EventName, event.EventTime, event.EventSource,
		event.Username, event.UserIdentity, event.WorkspaceID, event.RequestParameters,
		event.ResponseElements, event.EventRegion,
	)

	return err
}
