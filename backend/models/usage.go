package models

import (
	"database/sql"
	"fmt"
	"strconv"
	"time"
)

// WorkspaceUsage represents monthly usage tracking
type WorkspaceUsage struct {
	ID          int       `json:"id" db:"id"`
	WorkspaceID string    `json:"workspace_id" db:"workspace_id"`
	Month       string    `json:"month" db:"month"`
	UsageHours  float64   `json:"usage_hours" db:"usage_hours"`
	UserName    string    `json:"user_name,omitempty" db:"user_name"`
	BundleID    string    `json:"bundle_id,omitempty" db:"bundle_id"`
	RunningMode string    `json:"running_mode,omitempty" db:"running_mode"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// ListWorkspaceUsage retrieves usage data with filtering and pagination
func ListWorkspaceUsage(db *sql.DB, filters map[string]interface{}, limit, offset int) ([]WorkspaceUsage, int, error) {
	baseQuery := `
		SELECT wu.id, wu.workspace_id, wu.month, wu.usage_hours, wu.created_at, wu.updated_at,
		       w.user_name, w.bundle_id, w.running_mode
		FROM workspace_usage wu
		LEFT JOIN workspaces w ON wu.workspace_id = w.workspace_id
		WHERE 1=1
	`

	countQuery := `
		SELECT COUNT(*)
		FROM workspace_usage wu
		LEFT JOIN workspaces w ON wu.workspace_id = w.workspace_id
		WHERE 1=1
	`

	args := []interface{}{}
	argPos := 1

	// Apply filters
	if userName, ok := filters["user_name"].(string); ok && userName != "" {
		filterClause := fmt.Sprintf(" AND w.user_name ILIKE $%d", argPos)
		baseQuery += filterClause
		countQuery += filterClause
		args = append(args, "%"+userName+"%")
		argPos++
	}

	if workspaceID, ok := filters["workspace_id"].(string); ok && workspaceID != "" {
		filterClause := fmt.Sprintf(" AND wu.workspace_id = $%d", argPos)
		baseQuery += filterClause
		countQuery += filterClause
		args = append(args, workspaceID)
		argPos++
	}

	if monthFrom, ok := filters["month_from"].(string); ok && monthFrom != "" {
		filterClause := fmt.Sprintf(" AND wu.month >= $%d", argPos)
		baseQuery += filterClause
		countQuery += filterClause
		args = append(args, monthFrom)
		argPos++
	}

	if monthTo, ok := filters["month_to"].(string); ok && monthTo != "" {
		filterClause := fmt.Sprintf(" AND wu.month <= $%d", argPos)
		baseQuery += filterClause
		countQuery += filterClause
		args = append(args, monthTo)
		argPos++
	}

	// Get total count
	var total int
	err := db.QueryRow(countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Add sorting and pagination
	baseQuery += fmt.Sprintf(" ORDER BY wu.month DESC, wu.workspace_id LIMIT $%d OFFSET $%d", argPos, argPos+1)
	args = append(args, limit, offset)

	rows, err := db.Query(baseQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	usage := []WorkspaceUsage{}
	for rows.Next() {
		var u WorkspaceUsage
		err := rows.Scan(&u.ID, &u.WorkspaceID, &u.Month, &u.UsageHours, &u.CreatedAt, &u.UpdatedAt,
			&u.UserName, &u.BundleID, &u.RunningMode)
		if err != nil {
			return nil, 0, err
		}
		usage = append(usage, u)
	}

	return usage, total, nil
}

// GetWorkspaceUsage retrieves usage for a specific workspace and month
func GetWorkspaceUsage(db *sql.DB, workspaceID, month string) (*WorkspaceUsage, error) {
	query := `
		SELECT id, workspace_id, month, usage_hours, created_at, updated_at
		FROM workspace_usage
		WHERE workspace_id = $1 AND month = $2
	`

	var u WorkspaceUsage
	err := db.QueryRow(query, workspaceID, month).Scan(
		&u.ID, &u.WorkspaceID, &u.Month, &u.UsageHours, &u.CreatedAt, &u.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	return &u, nil
}

// UpsertWorkspaceUsage inserts or updates usage data
func UpsertWorkspaceUsage(db *sql.DB, workspaceID, month string, usageHours float64) error {
	query := `
		INSERT INTO workspace_usage (workspace_id, month, usage_hours, updated_at)
		VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
		ON CONFLICT (workspace_id, month) DO UPDATE SET
			usage_hours = EXCLUDED.usage_hours,
			updated_at = CURRENT_TIMESTAMP
	`

	_, err := db.Exec(query, workspaceID, month, usageHours)
	return err
}

// IncrementWorkspaceUsage adds hours to existing usage
func IncrementWorkspaceUsage(db *sql.DB, workspaceID, month string, additionalHours float64) error {
	query := `
		INSERT INTO workspace_usage (workspace_id, month, usage_hours, updated_at)
		VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
		ON CONFLICT (workspace_id, month) DO UPDATE SET
			usage_hours = workspace_usage.usage_hours + EXCLUDED.usage_hours,
			updated_at = CURRENT_TIMESTAMP
	`

	_, err := db.Exec(query, workspaceID, month, additionalHours)
	return err
}

// GetMonthlyUsageSummary gets aggregated usage for a month
func GetMonthlyUsageSummary(db *sql.DB, month string) (map[string]interface{}, error) {
	query := `
		SELECT
			COUNT(*) as workspace_count,
			COALESCE(SUM(usage_hours), 0) as total_hours,
			COALESCE(AVG(usage_hours), 0) as avg_hours,
			COALESCE(MAX(usage_hours), 0) as max_hours,
			COALESCE(MIN(usage_hours), 0) as min_hours
		FROM workspace_usage
		WHERE month = $1
	`

	var count int
	var totalHours, avgHours, maxHours, minHours float64

	err := db.QueryRow(query, month).Scan(&count, &totalHours, &avgHours, &maxHours, &minHours)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"workspace_count": count,
		"total_hours":     totalHours,
		"avg_hours":       avgHours,
		"max_hours":       maxHours,
		"min_hours":       minHours,
	}, nil
}

// BuildUsageFilters parses query parameters into filters map
func BuildUsageFilters(queryParams map[string][]string) map[string]interface{} {
	filters := make(map[string]interface{})

	if userName := getFirstParam(queryParams, "user_name"); userName != "" {
		filters["user_name"] = userName
	}

	if workspaceID := getFirstParam(queryParams, "workspace_id"); workspaceID != "" {
		filters["workspace_id"] = workspaceID
	}

	if monthFrom := getFirstParam(queryParams, "month_from"); monthFrom != "" {
		filters["month_from"] = monthFrom
	}

	if monthTo := getFirstParam(queryParams, "month_to"); monthTo != "" {
		filters["month_to"] = monthTo
	}

	return filters
}

// ParsePagination parses limit and offset from query parameters
func ParsePagination(queryParams map[string][]string) (int, int) {
	limit := 20
	offset := 0

	if limitStr := getFirstParam(queryParams, "limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}

	if offsetStr := getFirstParam(queryParams, "offset"); offsetStr != "" {
		if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
			offset = o
		}
	}

	return limit, offset
}

func getFirstParam(params map[string][]string, key string) string {
	if values, ok := params[key]; ok && len(values) > 0 {
		return values[0]
	}
	return ""
}
