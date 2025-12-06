package models

import (
	"database/sql"
	"encoding/json"
	"time"
)

// Workspace represents an AWS WorkSpace
type Workspace struct {
	WorkspaceID                         string          `json:"workspace_id" db:"workspace_id"`
	UserName                            string          `json:"user_name" db:"user_name"`
	DisplayName                         string          `json:"display_name" db:"display_name"`
	DirectoryID                         string          `json:"directory_id" db:"directory_id"`
	IPAddress                           string          `json:"ip_address" db:"ip_address"`
	State                               string          `json:"state" db:"state"`
	BundleID                            string          `json:"bundle_id" db:"bundle_id"`
	SubnetID                            string          `json:"subnet_id" db:"subnet_id"`
	ComputerName                        string          `json:"computer_name" db:"computer_name"`
	RunningMode                         string          `json:"running_mode" db:"running_mode"`
	RootVolumeSizeGib                   int             `json:"root_volume_size_gib" db:"root_volume_size_gib"`
	UserVolumeSizeGib                   int             `json:"user_volume_size_gib" db:"user_volume_size_gib"`
	ComputeTypeName                     string          `json:"compute_type_name" db:"compute_type_name"`
	CreatedAt                           *time.Time      `json:"created_at" db:"created_at"`
	TerminatedAt                        *time.Time      `json:"terminated_at" db:"terminated_at"`
	LastKnownUserConnectionTimestamp    *time.Time      `json:"last_known_user_connection_timestamp" db:"last_known_user_connection_timestamp"`
	CreatedByUser                       string          `json:"created_by_user" db:"created_by_user"`
	TerminatedByUser                    string          `json:"terminated_by_user" db:"terminated_by_user"`
	Tags                                json.RawMessage `json:"tags" db:"tags"`
	UpdatedAt                           time.Time       `json:"updated_at" db:"updated_at"`
}

// WorkspaceUsage represents monthly usage data for a workspace
type WorkspaceUsage struct {
	ID          int       `json:"id" db:"id"`
	WorkspaceID string    `json:"workspace_id" db:"workspace_id"`
	Month       string    `json:"month" db:"month"` // YYYY-MM format
	UsageHours  float64   `json:"usage_hours" db:"usage_hours"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// GetWorkspaceByID retrieves a workspace by ID
func GetWorkspaceByID(db *sql.DB, workspaceID string) (*Workspace, error) {
	var ws Workspace
	query := `
		SELECT workspace_id, user_name, display_name, directory_id, ip_address,
		       state, bundle_id, subnet_id, computer_name, running_mode,
		       root_volume_size_gib, user_volume_size_gib, compute_type_name,
		       created_at, terminated_at, last_known_user_connection_timestamp,
		       created_by_user, terminated_by_user, tags, updated_at
		FROM workspaces
		WHERE workspace_id = $1
	`
	err := db.QueryRow(query, workspaceID).Scan(
		&ws.WorkspaceID, &ws.UserName, &ws.DisplayName, &ws.DirectoryID, &ws.IPAddress,
		&ws.State, &ws.BundleID, &ws.SubnetID, &ws.ComputerName, &ws.RunningMode,
		&ws.RootVolumeSizeGib, &ws.UserVolumeSizeGib, &ws.ComputeTypeName,
		&ws.CreatedAt, &ws.TerminatedAt, &ws.LastKnownUserConnectionTimestamp,
		&ws.CreatedByUser, &ws.TerminatedByUser, &ws.Tags, &ws.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &ws, nil
}

// ListWorkspaces retrieves workspaces with filtering and pagination
func ListWorkspaces(db *sql.DB, filters map[string]interface{}, limit, offset int) ([]Workspace, int, error) {
	// Build query with filters
	baseQuery := `
		SELECT workspace_id, user_name, display_name, directory_id, ip_address,
		       state, bundle_id, subnet_id, computer_name, running_mode,
		       root_volume_size_gib, user_volume_size_gib, compute_type_name,
		       created_at, terminated_at, last_known_user_connection_timestamp,
		       created_by_user, terminated_by_user, tags, updated_at
		FROM workspaces
		WHERE 1=1
	`

	countQuery := "SELECT COUNT(*) FROM workspaces WHERE 1=1"
	args := []interface{}{}
	argPos := 1

	// Apply filters
	if userName, ok := filters["user_name"].(string); ok && userName != "" {
		baseQuery += " AND user_name = $" + string(rune(argPos+'0'))
		countQuery += " AND user_name = $" + string(rune(argPos+'0'))
		args = append(args, userName)
		argPos++
	}

	if state, ok := filters["state"].(string); ok && state != "" {
		baseQuery += " AND state = $" + string(rune(argPos+'0'))
		countQuery += " AND state = $" + string(rune(argPos+'0'))
		args = append(args, state)
		argPos++
	}

	// Get total count
	var total int
	err := db.QueryRow(countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Add pagination
	baseQuery += " ORDER BY created_at DESC LIMIT $" + string(rune(argPos+'0')) + " OFFSET $" + string(rune(argPos+1+'0'))
	args = append(args, limit, offset)

	rows, err := db.Query(baseQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	workspaces := []Workspace{}
	for rows.Next() {
		var ws Workspace
		err := rows.Scan(
			&ws.WorkspaceID, &ws.UserName, &ws.DisplayName, &ws.DirectoryID, &ws.IPAddress,
			&ws.State, &ws.BundleID, &ws.SubnetID, &ws.ComputerName, &ws.RunningMode,
			&ws.RootVolumeSizeGib, &ws.UserVolumeSizeGib, &ws.ComputeTypeName,
			&ws.CreatedAt, &ws.TerminatedAt, &ws.LastKnownUserConnectionTimestamp,
			&ws.CreatedByUser, &ws.TerminatedByUser, &ws.Tags, &ws.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		workspaces = append(workspaces, ws)
	}

	return workspaces, total, nil
}

// UpsertWorkspace inserts or updates a workspace
func UpsertWorkspace(db *sql.DB, ws *Workspace) error {
	query := `
		INSERT INTO workspaces (
			workspace_id, user_name, display_name, directory_id, ip_address,
			state, bundle_id, subnet_id, computer_name, running_mode,
			root_volume_size_gib, user_volume_size_gib, compute_type_name,
			created_at, terminated_at, last_known_user_connection_timestamp,
			created_by_user, terminated_by_user, tags, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, CURRENT_TIMESTAMP)
		ON CONFLICT (workspace_id) DO UPDATE SET
			user_name = EXCLUDED.user_name,
			display_name = EXCLUDED.display_name,
			directory_id = EXCLUDED.directory_id,
			ip_address = EXCLUDED.ip_address,
			state = EXCLUDED.state,
			bundle_id = EXCLUDED.bundle_id,
			subnet_id = EXCLUDED.subnet_id,
			computer_name = EXCLUDED.computer_name,
			running_mode = EXCLUDED.running_mode,
			root_volume_size_gib = EXCLUDED.root_volume_size_gib,
			user_volume_size_gib = EXCLUDED.user_volume_size_gib,
			compute_type_name = EXCLUDED.compute_type_name,
			created_at = EXCLUDED.created_at,
			terminated_at = EXCLUDED.terminated_at,
			last_known_user_connection_timestamp = EXCLUDED.last_known_user_connection_timestamp,
			created_by_user = EXCLUDED.created_by_user,
			terminated_by_user = EXCLUDED.terminated_by_user,
			tags = EXCLUDED.tags,
			updated_at = CURRENT_TIMESTAMP
	`

	_, err := db.Exec(query,
		ws.WorkspaceID, ws.UserName, ws.DisplayName, ws.DirectoryID, ws.IPAddress,
		ws.State, ws.BundleID, ws.SubnetID, ws.ComputerName, ws.RunningMode,
		ws.RootVolumeSizeGib, ws.UserVolumeSizeGib, ws.ComputeTypeName,
		ws.CreatedAt, ws.TerminatedAt, ws.LastKnownUserConnectionTimestamp,
		ws.CreatedByUser, ws.TerminatedByUser, ws.Tags,
	)

	return err
}
