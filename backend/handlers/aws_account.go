package handlers

import (
	"database/sql"
	"net/http"
	"strconv"

	"github.com/4syedalihassan/workspaces-inventory/models"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/sts"
	"github.com/aws/aws-sdk-go/service/workspaces"
	"github.com/gin-gonic/gin"
)

type AWSAccountHandler struct {
	DB *sql.DB
}

// ListAWSAccounts returns all AWS accounts
func (h *AWSAccountHandler) ListAWSAccounts(c *gin.Context) {
	accounts, err := models.GetAllAWSAccounts(h.DB)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve AWS accounts"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"accounts": accounts})
}

// GetAWSAccount returns a single AWS account by ID
func (h *AWSAccountHandler) GetAWSAccount(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid account ID"})
		return
	}

	account, err := models.GetAWSAccountByID(h.DB, id)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "AWS account not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve AWS account"})
		return
	}

	c.JSON(http.StatusOK, account)
}

// CreateAWSAccount creates a new AWS account
func (h *AWSAccountHandler) CreateAWSAccount(c *gin.Context) {
	var req models.CreateAWSAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate region
	validRegions := map[string]bool{
		"us-east-1":      true,
		"us-east-2":      true,
		"us-west-1":      true,
		"us-west-2":      true,
		"eu-west-1":      true,
		"eu-central-1":   true,
		"ap-southeast-1": true,
		"ap-northeast-1": true,
	}
	if !validRegions[req.Region] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid AWS region"})
		return
	}

	account := &models.AWSAccount{
		Name:            req.Name,
		Region:          req.Region,
		AccessKeyID:     req.AccessKeyID,
		SecretAccessKey: req.SecretAccessKey,
		IsDefault:       req.IsDefault,
		IsActive:        true,
		Status:          "pending",
	}

	if err := models.CreateAWSAccount(h.DB, account); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create AWS account"})
		return
	}

	// Try to fetch account ID from AWS
	go h.fetchAndUpdateAccountID(account.ID, account.Region, account.AccessKeyID, account.SecretAccessKey)

	c.JSON(http.StatusCreated, account)
}

// UpdateAWSAccount updates an existing AWS account
func (h *AWSAccountHandler) UpdateAWSAccount(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid account ID"})
		return
	}

	var req models.UpdateAWSAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify account exists
	_, err = models.GetAWSAccountByID(h.DB, id)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "AWS account not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve AWS account"})
		return
	}

	if err := models.UpdateAWSAccount(h.DB, id, req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update AWS account"})
		return
	}

	// If credentials were updated, fetch account ID
	if req.AccessKeyID != "" && req.SecretAccessKey != "" {
		region := req.Region
		if region == "" {
			// Get current region from DB
			account, _ := models.GetAWSAccountByID(h.DB, id)
			if account != nil {
				region = account.Region
			}
		}
		go h.fetchAndUpdateAccountID(id, region, req.AccessKeyID, req.SecretAccessKey)
	}

	c.JSON(http.StatusOK, gin.H{"message": "AWS account updated successfully"})
}

// DeleteAWSAccount soft deletes an AWS account
func (h *AWSAccountHandler) DeleteAWSAccount(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid account ID"})
		return
	}

	if err := models.DeleteAWSAccount(h.DB, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete AWS account"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "AWS account deleted successfully"})
}

// TestAWSConnection tests the AWS credentials
func (h *AWSAccountHandler) TestAWSConnection(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid account ID"})
		return
	}

	account, err := models.GetAWSAccountByID(h.DB, id)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "AWS account not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve AWS account"})
		return
	}

	// Test connection
	sess, err := session.NewSession(&aws.Config{
		Region:      aws.String(account.Region),
		Credentials: credentials.NewStaticCredentials(account.AccessKeyID, account.SecretAccessKey, ""),
	})
	if err != nil {
		models.UpdateAWSAccountStatus(h.DB, id, "error")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to create AWS session", "details": err.Error()})
		return
	}

	// Try to call STS GetCallerIdentity to verify credentials
	stsClient := sts.New(sess)
	identity, err := stsClient.GetCallerIdentity(&sts.GetCallerIdentityInput{})
	if err != nil {
		models.UpdateAWSAccountStatus(h.DB, id, "error")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid AWS credentials", "details": err.Error()})
		return
	}

	// Update account ID if we got it
	if identity.Account != nil {
		models.UpdateAWSAccountID(h.DB, id, *identity.Account)
	}

	// Try to list WorkSpaces to verify permissions
	wsClient := workspaces.New(sess)
	_, err = wsClient.DescribeWorkspaces(&workspaces.DescribeWorkspacesInput{
		Limit: aws.Int64(1),
	})
	if err != nil {
		models.UpdateAWSAccountStatus(h.DB, id, "limited")
		c.JSON(http.StatusOK, gin.H{
			"status":    "limited",
			"message":   "Connection successful but limited WorkSpaces permissions",
			"accountId": identity.Account,
			"details":   err.Error(),
		})
		return
	}

	// Update status to connected
	models.UpdateAWSAccountStatus(h.DB, id, "connected")

	c.JSON(http.StatusOK, gin.H{
		"status":    "connected",
		"message":   "Connection successful",
		"accountId": identity.Account,
		"arn":       identity.Arn,
	})
}

// fetchAndUpdateAccountID fetches the AWS account ID using STS and updates it in the database
func (h *AWSAccountHandler) fetchAndUpdateAccountID(id int, region, accessKeyID, secretAccessKey string) {
	sess, err := session.NewSession(&aws.Config{
		Region:      aws.String(region),
		Credentials: credentials.NewStaticCredentials(accessKeyID, secretAccessKey, ""),
	})
	if err != nil {
		models.UpdateAWSAccountStatus(h.DB, id, "error")
		return
	}

	stsClient := sts.New(sess)
	identity, err := stsClient.GetCallerIdentity(&sts.GetCallerIdentityInput{})
	if err != nil {
		models.UpdateAWSAccountStatus(h.DB, id, "error")
		return
	}

	if identity.Account != nil {
		models.UpdateAWSAccountID(h.DB, id, *identity.Account)
	}

	// Test WorkSpaces permissions
	wsClient := workspaces.New(sess)
	_, err = wsClient.DescribeWorkspaces(&workspaces.DescribeWorkspacesInput{
		Limit: aws.Int64(1),
	})
	if err != nil {
		models.UpdateAWSAccountStatus(h.DB, id, "limited")
	} else {
		models.UpdateAWSAccountStatus(h.DB, id, "connected")
	}
}
