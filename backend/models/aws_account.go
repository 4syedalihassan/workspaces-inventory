package models

import (
	"database/sql"
	"time"
)

// AWSAccount represents an AWS account configuration
type AWSAccount struct {
	ID              int        `json:"id" db:"id"`
	Name            string     `json:"name" db:"name"`
	AccountID       *string    `json:"accountId,omitempty" db:"account_id"`
	Region          string     `json:"region" db:"region"`
	AccessKeyID     string     `json:"-" db:"access_key_id"`                    // Never expose in JSON
	SecretAccessKey string     `json:"-" db:"secret_access_key"`                // Never expose in JSON
	IsDefault       bool       `json:"isDefault" db:"is_default"`
	IsActive        bool       `json:"isActive" db:"is_active"`
	Status          string     `json:"status" db:"status"`
	LastSync        *time.Time `json:"lastSync,omitempty" db:"last_sync"`
	CreatedAt       time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt       time.Time  `json:"updatedAt" db:"updated_at"`
}

// CreateAWSAccountRequest is the request payload for creating an AWS account
type CreateAWSAccountRequest struct {
	Name            string `json:"name" binding:"required"`
	Region          string `json:"region" binding:"required"`
	AccessKeyID     string `json:"accessKeyId" binding:"required"`
	SecretAccessKey string `json:"secretAccessKey" binding:"required"`
	IsDefault       bool   `json:"isDefault"`
}

// UpdateAWSAccountRequest is the request payload for updating an AWS account
type UpdateAWSAccountRequest struct {
	Name            string `json:"name"`
	Region          string `json:"region"`
	AccessKeyID     string `json:"accessKeyId"`     // Optional - only update if provided
	SecretAccessKey string `json:"secretAccessKey"` // Optional - only update if provided
	IsDefault       bool   `json:"isDefault"`
}

// GetAllAWSAccounts retrieves all AWS accounts
func GetAllAWSAccounts(db *sql.DB) ([]AWSAccount, error) {
	query := `
		SELECT id, name, account_id, region, access_key_id, secret_access_key,
		       is_default, is_active, status, last_sync, created_at, updated_at
		FROM aws_accounts
		WHERE is_active = true
		ORDER BY is_default DESC, name ASC
	`
	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var accounts []AWSAccount
	for rows.Next() {
		var account AWSAccount
		err := rows.Scan(
			&account.ID, &account.Name, &account.AccountID, &account.Region,
			&account.AccessKeyID, &account.SecretAccessKey, &account.IsDefault,
			&account.IsActive, &account.Status, &account.LastSync,
			&account.CreatedAt, &account.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		accounts = append(accounts, account)
	}
	return accounts, nil
}

// GetAWSAccountByID retrieves an AWS account by ID
func GetAWSAccountByID(db *sql.DB, id int) (*AWSAccount, error) {
	query := `
		SELECT id, name, account_id, region, access_key_id, secret_access_key,
		       is_default, is_active, status, last_sync, created_at, updated_at
		FROM aws_accounts
		WHERE id = $1 AND is_active = true
	`
	var account AWSAccount
	err := db.QueryRow(query, id).Scan(
		&account.ID, &account.Name, &account.AccountID, &account.Region,
		&account.AccessKeyID, &account.SecretAccessKey, &account.IsDefault,
		&account.IsActive, &account.Status, &account.LastSync,
		&account.CreatedAt, &account.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &account, nil
}

// GetDefaultAWSAccount retrieves the default AWS account
func GetDefaultAWSAccount(db *sql.DB) (*AWSAccount, error) {
	query := `
		SELECT id, name, account_id, region, access_key_id, secret_access_key,
		       is_default, is_active, status, last_sync, created_at, updated_at
		FROM aws_accounts
		WHERE is_default = true AND is_active = true
		LIMIT 1
	`
	var account AWSAccount
	err := db.QueryRow(query).Scan(
		&account.ID, &account.Name, &account.AccountID, &account.Region,
		&account.AccessKeyID, &account.SecretAccessKey, &account.IsDefault,
		&account.IsActive, &account.Status, &account.LastSync,
		&account.CreatedAt, &account.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &account, nil
}

// CreateAWSAccount creates a new AWS account
func CreateAWSAccount(db *sql.DB, account *AWSAccount) error {
	// If this is being set as default, unset all other defaults
	if account.IsDefault {
		_, err := db.Exec("UPDATE aws_accounts SET is_default = false WHERE is_default = true")
		if err != nil {
			return err
		}
	}

	query := `
		INSERT INTO aws_accounts (name, region, access_key_id, secret_access_key, is_default, status)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at, updated_at
	`
	return db.QueryRow(
		query,
		account.Name,
		account.Region,
		account.AccessKeyID,
		account.SecretAccessKey,
		account.IsDefault,
		"pending",
	).Scan(&account.ID, &account.CreatedAt, &account.UpdatedAt)
}

// UpdateAWSAccount updates an AWS account
func UpdateAWSAccount(db *sql.DB, id int, req UpdateAWSAccountRequest) error {
	// If this is being set as default, unset all other defaults
	if req.IsDefault {
		_, err := db.Exec("UPDATE aws_accounts SET is_default = false WHERE is_default = true AND id != $1", id)
		if err != nil {
			return err
		}
	}

	// Build dynamic update query based on what's provided
	query := `
		UPDATE aws_accounts
		SET name = COALESCE(NULLIF($1, ''), name),
		    region = COALESCE(NULLIF($2, ''), region),
		    access_key_id = COALESCE(NULLIF($3, ''), access_key_id),
		    secret_access_key = COALESCE(NULLIF($4, ''), secret_access_key),
		    is_default = $5,
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = $6 AND is_active = true
	`
	_, err := db.Exec(query, req.Name, req.Region, req.AccessKeyID, req.SecretAccessKey, req.IsDefault, id)
	return err
}

// DeleteAWSAccount soft deletes an AWS account
func DeleteAWSAccount(db *sql.DB, id int) error {
	query := `UPDATE aws_accounts SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`
	_, err := db.Exec(query, id)
	return err
}

// UpdateAWSAccountStatus updates the status of an AWS account
func UpdateAWSAccountStatus(db *sql.DB, id int, status string) error {
	query := `UPDATE aws_accounts SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`
	_, err := db.Exec(query, status, id)
	return err
}

// UpdateAWSAccountLastSync updates the last sync timestamp
func UpdateAWSAccountLastSync(db *sql.DB, id int) error {
	query := `UPDATE aws_accounts SET last_sync = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`
	_, err := db.Exec(query, id)
	return err
}

// UpdateAWSAccountID updates the AWS account ID after fetching from AWS
func UpdateAWSAccountID(db *sql.DB, id int, accountID string) error {
	query := `UPDATE aws_accounts SET account_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`
	_, err := db.Exec(query, accountID, id)
	return err
}
