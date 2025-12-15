package models

import (
	"database/sql"
	"time"
)

// LDAPServer represents an LDAP/Active Directory server configuration
type LDAPServer struct {
	ID             int        `json:"id" db:"id"`
	Name           string     `json:"name" db:"name"`
	ServerURL      string     `json:"serverUrl" db:"server_url"`
	BaseDN         string     `json:"baseDn" db:"base_dn"`
	BindUsername   string     `json:"bindUsername" db:"bind_username"`
	BindPassword   string     `json:"-" db:"bind_password"`          // Never expose in JSON
	SearchFilter   string     `json:"searchFilter" db:"search_filter"`
	IsDefault      bool       `json:"isDefault" db:"is_default"`
	IsActive       bool       `json:"isActive" db:"is_active"`
	Status         string     `json:"status" db:"status"`
	LastSync       *time.Time `json:"lastSync,omitempty" db:"last_sync"`
	CreatedAt      time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt      time.Time  `json:"updatedAt" db:"updated_at"`
}

// CreateLDAPServerRequest is the request payload for creating an LDAP server
type CreateLDAPServerRequest struct {
	Name         string `json:"name" binding:"required"`
	ServerURL    string `json:"serverUrl" binding:"required"`
	BaseDN       string `json:"baseDn" binding:"required"`
	BindUsername string `json:"bindUsername" binding:"required"`
	BindPassword string `json:"bindPassword" binding:"required"`
	SearchFilter string `json:"searchFilter"`
	IsDefault    bool   `json:"isDefault"`
}

// UpdateLDAPServerRequest is the request payload for updating an LDAP server
type UpdateLDAPServerRequest struct {
	Name         string `json:"name"`
	ServerURL    string `json:"serverUrl"`
	BaseDN       string `json:"baseDn"`
	BindUsername string `json:"bindUsername"`
	BindPassword string `json:"bindPassword"` // Optional - only update if provided
	SearchFilter string `json:"searchFilter"`
	IsDefault    bool   `json:"isDefault"`
}

// GetAllLDAPServers retrieves all LDAP servers
func GetAllLDAPServers(db *sql.DB) ([]LDAPServer, error) {
	query := `
		SELECT id, name, server_url, base_dn, bind_username, bind_password,
		       search_filter, is_default, is_active, status, last_sync, created_at, updated_at
		FROM ldap_servers
		WHERE is_active = true
		ORDER BY is_default DESC, name ASC
	`
	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var servers []LDAPServer
	for rows.Next() {
		var server LDAPServer
		err := rows.Scan(
			&server.ID, &server.Name, &server.ServerURL, &server.BaseDN,
			&server.BindUsername, &server.BindPassword, &server.SearchFilter,
			&server.IsDefault, &server.IsActive, &server.Status, &server.LastSync,
			&server.CreatedAt, &server.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		servers = append(servers, server)
	}
	return servers, nil
}

// GetLDAPServerByID retrieves an LDAP server by ID
func GetLDAPServerByID(db *sql.DB, id int) (*LDAPServer, error) {
	query := `
		SELECT id, name, server_url, base_dn, bind_username, bind_password,
		       search_filter, is_default, is_active, status, last_sync, created_at, updated_at
		FROM ldap_servers
		WHERE id = $1 AND is_active = true
	`
	var server LDAPServer
	err := db.QueryRow(query, id).Scan(
		&server.ID, &server.Name, &server.ServerURL, &server.BaseDN,
		&server.BindUsername, &server.BindPassword, &server.SearchFilter,
		&server.IsDefault, &server.IsActive, &server.Status, &server.LastSync,
		&server.CreatedAt, &server.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &server, nil
}

// GetDefaultLDAPServer retrieves the default LDAP server
func GetDefaultLDAPServer(db *sql.DB) (*LDAPServer, error) {
	query := `
		SELECT id, name, server_url, base_dn, bind_username, bind_password,
		       search_filter, is_default, is_active, status, last_sync, created_at, updated_at
		FROM ldap_servers
		WHERE is_default = true AND is_active = true
		LIMIT 1
	`
	var server LDAPServer
	err := db.QueryRow(query).Scan(
		&server.ID, &server.Name, &server.ServerURL, &server.BaseDN,
		&server.BindUsername, &server.BindPassword, &server.SearchFilter,
		&server.IsDefault, &server.IsActive, &server.Status, &server.LastSync,
		&server.CreatedAt, &server.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &server, nil
}

// CreateLDAPServer creates a new LDAP server
func CreateLDAPServer(db *sql.DB, server *LDAPServer) error {
	// If this is being set as default, unset all other defaults
	if server.IsDefault {
		_, err := db.Exec("UPDATE ldap_servers SET is_default = false WHERE is_default = true")
		if err != nil {
			return err
		}
	}

	query := `
		INSERT INTO ldap_servers (name, server_url, base_dn, bind_username, bind_password, search_filter, is_default, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at, updated_at
	`
	return db.QueryRow(
		query,
		server.Name,
		server.ServerURL,
		server.BaseDN,
		server.BindUsername,
		server.BindPassword,
		server.SearchFilter,
		server.IsDefault,
		"pending",
	).Scan(&server.ID, &server.CreatedAt, &server.UpdatedAt)
}

// UpdateLDAPServer updates an LDAP server
func UpdateLDAPServer(db *sql.DB, id int, req UpdateLDAPServerRequest) error {
	// If this is being set as default, unset all other defaults
	if req.IsDefault {
		_, err := db.Exec("UPDATE ldap_servers SET is_default = false WHERE is_default = true AND id != $1", id)
		if err != nil {
			return err
		}
	}

	// Build dynamic update query based on what's provided
	query := `
		UPDATE ldap_servers
		SET name = COALESCE(NULLIF($1, ''), name),
		    server_url = COALESCE(NULLIF($2, ''), server_url),
		    base_dn = COALESCE(NULLIF($3, ''), base_dn),
		    bind_username = COALESCE(NULLIF($4, ''), bind_username),
		    bind_password = COALESCE(NULLIF($5, ''), bind_password),
		    search_filter = COALESCE(NULLIF($6, ''), search_filter),
		    is_default = $7,
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = $8 AND is_active = true
	`
	_, err := db.Exec(query, req.Name, req.ServerURL, req.BaseDN, req.BindUsername, req.BindPassword, req.SearchFilter, req.IsDefault, id)
	return err
}

// DeleteLDAPServer soft deletes an LDAP server
func DeleteLDAPServer(db *sql.DB, id int) error {
	query := `UPDATE ldap_servers SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`
	_, err := db.Exec(query, id)
	return err
}

// UpdateLDAPServerStatus updates the status of an LDAP server
func UpdateLDAPServerStatus(db *sql.DB, id int, status string) error {
	query := `UPDATE ldap_servers SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`
	_, err := db.Exec(query, status, id)
	return err
}

// UpdateLDAPServerLastSync updates the last sync timestamp
func UpdateLDAPServerLastSync(db *sql.DB, id int) error {
	query := `UPDATE ldap_servers SET last_sync = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`
	_, err := db.Exec(query, id)
	return err
}
