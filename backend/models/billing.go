package models

import (
	"database/sql"
	"time"
)

// BillingData represents AWS billing/cost data
type BillingData struct {
	ID          int       `json:"id" db:"id"`
	WorkspaceID string    `json:"workspace_id" db:"workspace_id"`
	Service     string    `json:"service" db:"service"`
	UsageType   string    `json:"usage_type" db:"usage_type"`
	StartDate   time.Time `json:"start_date" db:"start_date"`
	EndDate     time.Time `json:"end_date" db:"end_date"`
	Amount      float64   `json:"amount" db:"amount"`
	Unit        string    `json:"unit" db:"unit"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

// SyncHistory represents a sync job record
type SyncHistory struct {
	ID               int        `json:"id" db:"id"`
	SyncType         string     `json:"sync_type" db:"sync_type"`
	Status           string     `json:"status" db:"status"`
	RecordsProcessed int        `json:"records_processed" db:"records_processed"`
	ErrorMessage     string     `json:"error_message" db:"error_message"`
	StartedAt        time.Time  `json:"started_at" db:"started_at"`
	CompletedAt      *time.Time `json:"completed_at" db:"completed_at"`
	CreatedAt        time.Time  `json:"created_at" db:"created_at"`
}

// ListBillingData retrieves billing data with filtering
func ListBillingData(db *sql.DB, filters map[string]interface{}, limit, offset int) ([]BillingData, int, error) {
	baseQuery := `
		SELECT id, workspace_id, service, usage_type, start_date, end_date, amount, unit, created_at
		FROM billing_data
		WHERE 1=1
	`

	countQuery := "SELECT COUNT(*) FROM billing_data WHERE 1=1"
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
	baseQuery += " ORDER BY start_date DESC LIMIT $" + string(rune(argPos+'0')) + " OFFSET $" + string(rune(argPos+1+'0'))
	args = append(args, limit, offset)

	rows, err := db.Query(baseQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	billingData := []BillingData{}
	for rows.Next() {
		var bd BillingData
		err := rows.Scan(&bd.ID, &bd.WorkspaceID, &bd.Service, &bd.UsageType,
			&bd.StartDate, &bd.EndDate, &bd.Amount, &bd.Unit, &bd.CreatedAt)
		if err != nil {
			return nil, 0, err
		}
		billingData = append(billingData, bd)
	}

	return billingData, total, nil
}

// UpsertBillingData inserts or updates billing data
func UpsertBillingData(db *sql.DB, bd *BillingData) error {
	query := `
		INSERT INTO billing_data (workspace_id, service, usage_type, start_date, end_date, amount, unit)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (workspace_id, service, usage_type, start_date, end_date) DO UPDATE SET
			amount = EXCLUDED.amount,
			unit = EXCLUDED.unit
	`

	_, err := db.Exec(query, bd.WorkspaceID, bd.Service, bd.UsageType,
		bd.StartDate, bd.EndDate, bd.Amount, bd.Unit)

	return err
}

// CreateSyncHistory creates a new sync history record
func CreateSyncHistory(db *sql.DB, syncType string) (*SyncHistory, error) {
	query := `
		INSERT INTO sync_history (sync_type, status, started_at)
		VALUES ($1, 'running', CURRENT_TIMESTAMP)
		RETURNING id, sync_type, status, records_processed, error_message, started_at, completed_at, created_at
	`

	var sh SyncHistory
	err := db.QueryRow(query, syncType).Scan(
		&sh.ID, &sh.SyncType, &sh.Status, &sh.RecordsProcessed,
		&sh.ErrorMessage, &sh.StartedAt, &sh.CompletedAt, &sh.CreatedAt,
	)

	return &sh, err
}

// UpdateSyncHistory updates a sync history record
func UpdateSyncHistory(db *sql.DB, id int, status string, recordsProcessed int, errorMessage string) error {
	query := `
		UPDATE sync_history
		SET status = $1, records_processed = $2, error_message = $3, completed_at = CURRENT_TIMESTAMP
		WHERE id = $4
	`

	_, err := db.Exec(query, status, recordsProcessed, errorMessage, id)
	return err
}

// ListSyncHistory retrieves sync history records
func ListSyncHistory(db *sql.DB, limit int) ([]SyncHistory, error) {
	query := `
		SELECT id, sync_type, status, records_processed, error_message, started_at, completed_at, created_at
		FROM sync_history
		ORDER BY created_at DESC
		LIMIT $1
	`

	rows, err := db.Query(query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	history := []SyncHistory{}
	for rows.Next() {
		var sh SyncHistory
		err := rows.Scan(&sh.ID, &sh.SyncType, &sh.Status, &sh.RecordsProcessed,
			&sh.ErrorMessage, &sh.StartedAt, &sh.CompletedAt, &sh.CreatedAt)
		if err != nil {
			return nil, err
		}
		history = append(history, sh)
	}

	return history, nil
}
