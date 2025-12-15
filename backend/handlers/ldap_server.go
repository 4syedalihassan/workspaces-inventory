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
	"github.com/go-ldap/ldap/v3"
)

type LDAPServerHandler struct {
	DB *sql.DB
}

// ListLDAPServers returns all LDAP servers
func (h *LDAPServerHandler) ListLDAPServers(c *gin.Context) {
	servers, err := models.GetAllLDAPServers(h.DB)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve LDAP servers"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"servers": servers})
}

// GetLDAPServer returns a single LDAP server by ID
func (h *LDAPServerHandler) GetLDAPServer(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid server ID"})
		return
	}

	server, err := models.GetLDAPServerByID(h.DB, id)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "LDAP server not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve LDAP server"})
		return
	}

	c.JSON(http.StatusOK, server)
}

// CreateLDAPServer creates a new LDAP server
func (h *LDAPServerHandler) CreateLDAPServer(c *gin.Context) {
	var req models.CreateLDAPServerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Set default search filter if not provided
	if req.SearchFilter == "" {
		req.SearchFilter = "(sAMAccountName={username})"
	}

	server := &models.LDAPServer{
		Name:         req.Name,
		ServerURL:    req.ServerURL,
		BaseDN:       req.BaseDN,
		BindUsername: req.BindUsername,
		BindPassword: req.BindPassword,
		SearchFilter: req.SearchFilter,
		IsDefault:    req.IsDefault,
		IsActive:     true,
		Status:       "pending",
	}

	if err := models.CreateLDAPServer(h.DB, server); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create LDAP server"})
		return
	}

	// Try to test connection in background
	go h.testLDAPConnection(server.ID, server.ServerURL, server.BindUsername, server.BindPassword)

	c.JSON(http.StatusCreated, server)
}

// UpdateLDAPServer updates an existing LDAP server
func (h *LDAPServerHandler) UpdateLDAPServer(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid server ID"})
		return
	}

	var req models.UpdateLDAPServerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify server exists
	_, err = models.GetLDAPServerByID(h.DB, id)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "LDAP server not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve LDAP server"})
		return
	}

	if err := models.UpdateLDAPServer(h.DB, id, req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update LDAP server"})
		return
	}

	// If any connection-related field was updated, test connection
	if req.ServerURL != "" || req.BindUsername != "" || req.BindPassword != "" {
		// Get current values from DB
		server, _ := models.GetLDAPServerByID(h.DB, id)
		serverURL := req.ServerURL
		bindUsername := req.BindUsername
		bindPassword := req.BindPassword
		if server != nil {
			if serverURL == "" {
				serverURL = server.ServerURL
			}
			if bindUsername == "" {
				bindUsername = server.BindUsername
			}
			if bindPassword == "" {
				bindPassword = server.BindPassword
			}
		}
		go h.testLDAPConnection(id, serverURL, bindUsername, bindPassword)
	}

	c.JSON(http.StatusOK, gin.H{"message": "LDAP server updated successfully"})
}

// DeleteLDAPServer soft deletes an LDAP server
func (h *LDAPServerHandler) DeleteLDAPServer(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid server ID"})
		return
	}

	if err := models.DeleteLDAPServer(h.DB, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete LDAP server"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "LDAP server deleted successfully"})
}

// TestLDAPConnection tests the LDAP credentials
func (h *LDAPServerHandler) TestLDAPConnection(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid server ID"})
		return
	}

	server, err := models.GetLDAPServerByID(h.DB, id)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "LDAP server not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve LDAP server"})
		return
	}

	// Test connection
	l, err := ldap.DialURL(server.ServerURL)
	if err != nil {
		models.UpdateLDAPServerStatus(h.DB, id, "error")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to connect to LDAP server", "details": err.Error()})
		return
	}
	defer l.Close()

	// Try to bind with credentials
	err = l.Bind(server.BindUsername, server.BindPassword)
	if err != nil {
		models.UpdateLDAPServerStatus(h.DB, id, "error")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid LDAP credentials", "details": err.Error()})
		return
	}

	// Try a simple search to verify permissions
	searchRequest := ldap.NewSearchRequest(
		server.BaseDN,
		ldap.ScopeBaseObject, ldap.NeverDerefAliases, 0, 0, false,
		"(objectClass=*)",
		[]string{"dn"},
		nil,
	)

	_, err = l.Search(searchRequest)
	if err != nil {
		models.UpdateLDAPServerStatus(h.DB, id, "limited")
		c.JSON(http.StatusOK, gin.H{
			"status":  "limited",
			"message": "Connection successful but limited permissions",
			"details": err.Error(),
		})
		return
	}

	// Update status to connected
	models.UpdateLDAPServerStatus(h.DB, id, "connected")

	c.JSON(http.StatusOK, gin.H{
		"status":  "connected",
		"message": "Connection successful",
	})
}

// SyncLDAPServer triggers a sync for a specific LDAP server
func (h *LDAPServerHandler) SyncLDAPServer(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid server ID"})
		return
	}

	// Verify server exists
	server, err := models.GetLDAPServerByID(h.DB, id)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "LDAP server not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve LDAP server"})
		return
	}

	// Run sync asynchronously
	go h.syncServer(id, server.Name)

	c.JSON(http.StatusAccepted, gin.H{
		"message":   "Sync started",
		"server_id": id,
		"server_name": server.Name,
	})
}

// syncServer performs the actual sync operation for a server
func (h *LDAPServerHandler) syncServer(serverID int, serverName string) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	awsService := &services.AWSService{DB: h.DB}
	notificationService := &services.NotificationService{DB: h.DB}

	// Sync users from this LDAP server
	recordsProcessed, err := awsService.SyncActiveDirectoryUsersFromServer(ctx, serverID)
	
	if err != nil {
		// Update server status to error
		models.UpdateLDAPServerStatus(h.DB, serverID, "error")
		// Send failure notification
		notificationService.NotifySyncFailed(serverName, err.Error())
	} else {
		// Update server status to connected
		models.UpdateLDAPServerStatus(h.DB, serverID, "connected")
		// Send success notification
		notificationService.NotifySyncCompleted(serverName, recordsProcessed)
	}
}

// testLDAPConnection tests the LDAP connection in the background
func (h *LDAPServerHandler) testLDAPConnection(id int, serverURL, bindUsername, bindPassword string) {
	l, err := ldap.DialURL(serverURL)
	if err != nil {
		models.UpdateLDAPServerStatus(h.DB, id, "error")
		return
	}
	defer l.Close()

	err = l.Bind(bindUsername, bindPassword)
	if err != nil {
		models.UpdateLDAPServerStatus(h.DB, id, "error")
		return
	}

	models.UpdateLDAPServerStatus(h.DB, id, "connected")
}
