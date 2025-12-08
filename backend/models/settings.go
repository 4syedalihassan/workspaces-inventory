package models

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"errors"
	"io"
	"time"
)

type Setting struct {
	ID          int       `json:"id"`
	Key         string    `json:"key"`
	Value       string    `json:"value"`
	Encrypted   bool      `json:"encrypted"`
	Category    string    `json:"category"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Encryption key - in production, this should be from environment variable
var encryptionKey = []byte("your-32-byte-long-encryption-key!")

// GetSetting retrieves a single setting by key
func GetSetting(db *sql.DB, key string) (*Setting, error) {
	setting := &Setting{}
	err := db.QueryRow(`
		SELECT id, key, value, encrypted, category, description, created_at, updated_at
		FROM settings
		WHERE key = $1
	`, key).Scan(&setting.ID, &setting.Key, &setting.Value, &setting.Encrypted,
		&setting.Category, &setting.Description, &setting.CreatedAt, &setting.UpdatedAt)

	if err != nil {
		return nil, err
	}

	// Decrypt if encrypted
	if setting.Encrypted && setting.Value != "" {
		decrypted, err := decrypt(setting.Value)
		if err != nil {
			return nil, err
		}
		setting.Value = decrypted
	}

	return setting, nil
}

// ListSettings retrieves all settings, optionally filtered by category
func ListSettings(db *sql.DB, category string) ([]Setting, error) {
	var rows *sql.Rows
	var err error

	if category != "" {
		rows, err = db.Query(`
			SELECT id, key, value, encrypted, category, description, created_at, updated_at
			FROM settings
			WHERE category = $1
			ORDER BY category, key
		`, category)
	} else {
		rows, err = db.Query(`
			SELECT id, key, value, encrypted, category, description, created_at, updated_at
			FROM settings
			ORDER BY category, key
		`)
	}

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	settings := []Setting{}
	for rows.Next() {
		var s Setting
		err := rows.Scan(&s.ID, &s.Key, &s.Value, &s.Encrypted,
			&s.Category, &s.Description, &s.CreatedAt, &s.UpdatedAt)
		if err != nil {
			return nil, err
		}

		// Decrypt if encrypted
		if s.Encrypted && s.Value != "" {
			decrypted, err := decrypt(s.Value)
			if err != nil {
				// Don't fail, just mask the value
				s.Value = "***ENCRYPTED***"
			} else {
				s.Value = decrypted
			}
		}

		settings = append(settings, s)
	}

	return settings, nil
}

// UpdateSetting updates or creates a setting
func UpdateSetting(db *sql.DB, key, value string) error {
	// Get current setting to check if it should be encrypted
	var encrypted bool
	err := db.QueryRow("SELECT encrypted FROM settings WHERE key = $1", key).Scan(&encrypted)
	if err != nil && err != sql.ErrNoRows {
		return err
	}

	// Encrypt if needed
	finalValue := value
	if encrypted && value != "" {
		encryptedValue, err := encrypt(value)
		if err != nil {
			return err
		}
		finalValue = encryptedValue
	}

	// Upsert
	_, err = db.Exec(`
		INSERT INTO settings (key, value, updated_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (key) DO UPDATE
		SET value = $2, updated_at = NOW()
	`, key, finalValue)

	return err
}

// DeleteSetting deletes a setting
func DeleteSetting(db *sql.DB, key string) error {
	_, err := db.Exec("DELETE FROM settings WHERE key = $1", key)
	return err
}

// GetSettingsByCategory returns settings grouped by category
func GetSettingsByCategory(db *sql.DB) (map[string][]Setting, error) {
	settings, err := ListSettings(db, "")
	if err != nil {
		return nil, err
	}

	grouped := make(map[string][]Setting)
	for _, s := range settings {
		grouped[s.Category] = append(grouped[s.Category], s)
	}

	return grouped, nil
}

// encrypt encrypts a plaintext string using AES
func encrypt(plaintext string) (string, error) {
	block, err := aes.NewCipher(encryptionKey)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// decrypt decrypts a base64-encoded ciphertext string using AES
func decrypt(ciphertext string) (string, error) {
	data, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(encryptionKey)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", errors.New("ciphertext too short")
	}

	nonce, ciphertextBytes := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertextBytes, nil)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}
