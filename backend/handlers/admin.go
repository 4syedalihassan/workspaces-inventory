package handlers

import (
	"context"
	"database/sql"
	"net/http"
	"strconv"
	"time"

	"github.com/4syedalihassan/workspaces-inventory/models"
	"github.com/4syedalihassan/workspaces-inventory/services"
	"github.com/gin-gonic/gin"
)

type AdminHandler struct {
	DB *sql.DB
}

// Settings Management

// GetSettings returns all settings or filtered by category
func (h *AdminHandler) GetSettings(c *gin.Context) {
	category := c.Query("category")

	settings, err := models.ListSettings(h.DB, category)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve settings"})
		return
	}

	// Group by category for easier frontend consumption
	if category == "" {
		grouped, err := models.GetSettingsByCategory(h.DB)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to group settings"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"settings": grouped})
		return
	}

	c.JSON(http.StatusOK, gin.H{"settings": settings})
}

// GetSetting returns a single setting
func (h *AdminHandler) GetSetting(c *gin.Context) {
	key := c.Param("key")

	setting, err := models.GetSetting(h.DB, key)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Setting not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve setting"})
		return
	}

	c.JSON(http.StatusOK, setting)
}

// UpdateSetting updates a setting value
func (h *AdminHandler) UpdateSetting(c *gin.Context) {
	key := c.Param("key")

	var req struct {
		Value string `json:"value" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := models.UpdateSetting(h.DB, key, req.Value)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update setting"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Setting updated successfully"})
}

// UpdateBulkSettings updates multiple settings at once
func (h *AdminHandler) UpdateBulkSettings(c *gin.Context) {
	var req map[string]string

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update each setting
	for key, value := range req {
		err := models.UpdateSetting(h.DB, key, value)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to update setting: " + key,
			})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Settings updated successfully",
		"count":   len(req),
	})
}

// User Management

// ListUsers returns all users
func (h *AdminHandler) ListUsers(c *gin.Context) {
	rows, err := h.DB.Query(`
		SELECT id, username, email, role, duo_verified, last_login, created_at, updated_at
		FROM users
		ORDER BY created_at DESC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve users"})
		return
	}
	defer rows.Close()

	users := []models.User{}
	for rows.Next() {
		var u models.User
		err := rows.Scan(&u.ID, &u.Username, &u.Email, &u.Role, &u.DuoVerified,
			&u.LastLogin, &u.CreatedAt, &u.UpdatedAt)
		if err != nil {
			continue
		}
		// Don't send password hash
		u.PasswordHash = ""
		users = append(users, u)
	}

	c.JSON(http.StatusOK, gin.H{"users": users})
}

// CreateUser creates a new user
func (h *AdminHandler) CreateUser(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		Email    string `json:"email" binding:"required"`
		Password string `json:"password" binding:"required"`
		Role     string `json:"role"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Set default role if not provided
	if req.Role == "" {
		req.Role = "USER"
	}

	// Hash password
	hash, err := models.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	// Insert user
	var userID int
	err = h.DB.QueryRow(`
		INSERT INTO users (username, email, password_hash, role)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`, req.Username, req.Email, hash, req.Role).Scan(&userID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "User created successfully",
		"user_id": userID,
	})
}

// UpdateUser updates a user
func (h *AdminHandler) UpdateUser(c *gin.Context) {
	userID := c.Param("id")

	var req struct {
		Email    string `json:"email"`
		Role     string `json:"role"`
		Password string `json:"password"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Build update query dynamically
	updates := make(map[string]interface{})
	if req.Email != "" {
		updates["email"] = req.Email
	}
	if req.Role != "" {
		updates["role"] = req.Role
	}
	if req.Password != "" {
		hash, err := models.HashPassword(req.Password)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
			return
		}
		updates["password_hash"] = hash
	}

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No fields to update"})
		return
	}

	// Update user
	query := "UPDATE users SET updated_at = NOW()"
	args := []interface{}{}
	i := 1

	for key, value := range updates {
		query += ", " + key + " = $" + string(rune(i+'0'))
		args = append(args, value)
		i++
	}

	query += " WHERE id = $" + string(rune(i+'0'))
	args = append(args, userID)

	_, err := h.DB.Exec(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User updated successfully"})
}

// DeleteUser deletes a user
func (h *AdminHandler) DeleteUser(c *gin.Context) {
	userID := c.Param("id")

	// Convert userID string to int for comparison
	userIDInt, err := strconv.Atoi(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	// Don't allow deleting yourself
	currentUserID, _ := c.Get("user_id")
	if currentUserIDInt, ok := currentUserID.(int); ok && currentUserIDInt == userIDInt {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot delete your own account"})
		return
	}

	_, deleteErr := h.DB.Exec("DELETE FROM users WHERE id = $1", userIDInt)
	if deleteErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User deleted successfully"})
}

// TestAWSConnection tests AWS credentials
func (h *AdminHandler) TestAWSConnection(c *gin.Context) {
	awsService := &services.AWSService{DB: h.DB}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	err := awsService.TestConnection(ctx)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "failed",
			"message": "Failed to connect to AWS",
			"error":   err.Error(),
		})
		return
	}

	region, _ := models.GetSetting(h.DB, "aws.region")
	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "AWS connection successful",
		"region":  region.Value,
	})
}
