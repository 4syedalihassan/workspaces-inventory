package handlers

import (
	"database/sql"
	"net/http"

	"github.com/4syedalihassan/workspaces-inventory/middleware"
	"github.com/4syedalihassan/workspaces-inventory/models"
	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	DB *sql.DB
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	Token        string      `json:"token"`
	User         *models.User `json:"user"`
	RequiresMFA  bool        `json:"requires_mfa"`
}

type MFAVerifyRequest struct {
	Username string `json:"username" binding:"required"`
	Passcode string `json:"passcode" binding:"required"`
}

// Login handles user login with password
func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get user from database
	user, err := models.GetUserByUsername(h.DB, req.Username)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve user"})
		return
	}

	// Check password
	if !models.CheckPassword(req.Password, user.PasswordHash) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	// For now, assume MFA is always required in production
	// In a real implementation, you would initiate DUO MFA here

	// Generate JWT token (temporary - should be after MFA verification)
	token, err := middleware.GenerateToken(user.ID, user.Username, user.Email, user.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	// Update last login
	models.UpdateLastLogin(h.DB, user.ID)

	c.JSON(http.StatusOK, LoginResponse{
		Token:       token,
		User:        user,
		RequiresMFA: false, // Set to true when DUO is integrated
	})
}

// VerifyMFA handles DUO MFA verification
func (h *AuthHandler) VerifyMFA(c *gin.Context) {
	var req MFAVerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get user from database
	user, err := models.GetUserByUsername(h.DB, req.Username)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	// TODO: Implement DUO MFA verification
	// For now, just generate token
	token, err := middleware.GenerateToken(user.ID, user.Username, user.Email, user.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user":  user,
	})
}

// Me returns the current user's information
func (h *AuthHandler) Me(c *gin.Context) {
	username, _ := c.Get("username")

	user, err := models.GetUserByUsername(h.DB, username.(string))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, user)
}
