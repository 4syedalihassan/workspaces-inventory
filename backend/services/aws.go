package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/4syedalihassan/workspaces-inventory/models"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/cloudtrail"
	cttypes "github.com/aws/aws-sdk-go-v2/service/cloudtrail/types"
	"github.com/aws/aws-sdk-go-v2/service/costexplorer"
	cetypes "github.com/aws/aws-sdk-go-v2/service/costexplorer/types"
	"github.com/aws/aws-sdk-go-v2/service/workspaces"
	wstypes "github.com/aws/aws-sdk-go-v2/service/workspaces/types"
	"github.com/go-ldap/ldap/v3"
)

type AWSService struct {
	DB *sql.DB
}

// GetAWSConfig creates AWS config from database settings (legacy - for backwards compatibility)
func (s *AWSService) GetAWSConfig(ctx context.Context) (aws.Config, error) {
	// Get credentials from database settings (old approach)
	region, err := models.GetSetting(s.DB, "aws.region")
	if err != nil {
		return aws.Config{}, err
	}

	accessKey, err := models.GetSetting(s.DB, "aws.access_key_id")
	if err != nil {
		return aws.Config{}, err
	}

	secretKey, err := models.GetSetting(s.DB, "aws.secret_access_key")
	if err != nil {
		return aws.Config{}, err
	}

	if accessKey.Value == "" || secretKey.Value == "" {
		return aws.Config{}, fmt.Errorf("AWS credentials not configured")
	}

	// Create config with credentials
	cfg, err := config.LoadDefaultConfig(ctx,
		config.WithRegion(region.Value),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			accessKey.Value,
			secretKey.Value,
			"",
		)),
	)

	return cfg, err
}

// GetAWSConfigForAccount creates AWS config for a specific AWS account
func (s *AWSService) GetAWSConfigForAccount(ctx context.Context, accountID int) (aws.Config, error) {
	// Get account credentials from aws_accounts table
	account, err := models.GetAWSAccountByID(s.DB, accountID)
	if err != nil {
		return aws.Config{}, fmt.Errorf("failed to get AWS account: %w", err)
	}

	if account.AccessKeyID == "" || account.SecretAccessKey == "" {
		return aws.Config{}, fmt.Errorf("AWS credentials not configured for account %s", account.Name)
	}

	// Create config with credentials
	cfg, err := config.LoadDefaultConfig(ctx,
		config.WithRegion(account.Region),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			account.AccessKeyID,
			account.SecretAccessKey,
			"",
		)),
	)

	return cfg, err
}

// SyncWorkSpaces fetches all WorkSpaces from AWS and stores them (legacy - uses default account)
func (s *AWSService) SyncWorkSpaces(ctx context.Context) (int, error) {
	// Try to get default account first
	defaultAccount, err := models.GetDefaultAWSAccount(s.DB)
	if err == nil && defaultAccount != nil {
		return s.SyncWorkSpacesForAccount(ctx, defaultAccount.ID)
	}

	// Fallback to legacy settings-based config
	cfg, err := s.GetAWSConfig(ctx)
	if err != nil {
		return 0, err
	}

	// Create WorkSpaces client
	client := workspaces.NewFromConfig(cfg)

	// Describe all workspaces using pagination
	log.Println("Fetching WorkSpaces from AWS (legacy mode)...")
	input := &workspaces.DescribeWorkspacesInput{}

	count := 0
	paginator := workspaces.NewDescribeWorkspacesPaginator(client, input)

	for paginator.HasMorePages() {
		page, err := paginator.NextPage(ctx)
		if err != nil {
			return count, fmt.Errorf("failed to get page: %w", err)
		}

		for _, ws := range page.Workspaces {
			// Upsert workspace without account ID (legacy)
			err := s.upsertWorkspace(ws, 0)
			if err != nil {
				log.Printf("Failed to upsert workspace %s: %v", *ws.WorkspaceId, err)
				continue
			}
			count++
		}
	}

	log.Printf("Successfully synced %d workspaces", count)
	return count, nil
}

// SyncWorkSpacesForAccount fetches all WorkSpaces from AWS for a specific account
func (s *AWSService) SyncWorkSpacesForAccount(ctx context.Context, accountID int) (int, error) {
	cfg, err := s.GetAWSConfigForAccount(ctx, accountID)
	if err != nil {
		return 0, err
	}

	// Create WorkSpaces client
	client := workspaces.NewFromConfig(cfg)

	// Describe all workspaces using pagination
	log.Printf("Fetching WorkSpaces from AWS for account ID %d...", accountID)
	input := &workspaces.DescribeWorkspacesInput{}

	count := 0
	paginator := workspaces.NewDescribeWorkspacesPaginator(client, input)

	for paginator.HasMorePages() {
		page, err := paginator.NextPage(ctx)
		if err != nil {
			return count, fmt.Errorf("failed to get page: %w", err)
		}

		for _, ws := range page.Workspaces {
			// Upsert workspace with account ID
			err := s.upsertWorkspace(ws, accountID)
			if err != nil {
				log.Printf("Failed to upsert workspace %s: %v", *ws.WorkspaceId, err)
				continue
			}
			count++
		}
	}

	// Update last sync timestamp for the account
	models.UpdateAWSAccountLastSync(s.DB, accountID)

	log.Printf("Successfully synced %d workspaces for account ID %d", count, accountID)
	return count, nil
}

// SyncAllAccounts syncs WorkSpaces from all active AWS accounts
func (s *AWSService) SyncAllAccounts(ctx context.Context) (int, error) {
	// Get all active accounts
	accounts, err := models.GetAllAWSAccounts(s.DB)
	if err != nil {
		return 0, fmt.Errorf("failed to get AWS accounts: %w", err)
	}

	totalCount := 0
	for _, account := range accounts {
		if !account.IsActive || account.Status == "error" {
			log.Printf("Skipping inactive or error account: %s", account.Name)
			continue
		}

		count, err := s.SyncWorkSpacesForAccount(ctx, account.ID)
		if err != nil {
			log.Printf("Failed to sync account %s: %v", account.Name, err)
			models.UpdateAWSAccountStatus(s.DB, account.ID, "error")
			continue
		}

		totalCount += count
		models.UpdateAWSAccountStatus(s.DB, account.ID, "connected")
	}

	log.Printf("Successfully synced %d workspaces across all accounts", totalCount)
	return totalCount, nil
}

// upsertWorkspace inserts or updates a workspace in the database
func (s *AWSService) upsertWorkspace(ws wstypes.Workspace, accountID int) error {
	// Note: CreationTime, TerminationTime, and LastKnownUserConnectionTimestamp
	// are not available in AWS SDK v2 Workspace struct, so we set them to nil
	var createdAt, terminatedAt, lastConnection *time.Time

	// Convert bundle properties
	var rootVolSize, userVolSize *int32
	var computeTypeName *string

	if ws.WorkspaceProperties != nil {
		rootVolSize = ws.WorkspaceProperties.RootVolumeSizeGib
		userVolSize = ws.WorkspaceProperties.UserVolumeSizeGib
		// ComputeTypeName is a Compute type (string-based), not a pointer
		if ws.WorkspaceProperties.ComputeTypeName != "" {
			name := string(ws.WorkspaceProperties.ComputeTypeName)
			computeTypeName = &name
		}
	}

	var runningMode *string
	if ws.WorkspaceProperties != nil {
		// RunningMode is a RunningMode type (string-based), not a pointer
		if ws.WorkspaceProperties.RunningMode != "" {
			mode := string(ws.WorkspaceProperties.RunningMode)
			runningMode = &mode
		}
	}

	var state *string
	// State is a WorkspaceState type (string-based), not a pointer
	if ws.State != "" {
		st := string(ws.State)
		state = &st
	}

	// Handle account ID (use NULL if 0 for legacy support)
	var accountIDPtr *int
	if accountID > 0 {
		accountIDPtr = &accountID
	}

	_, err := s.DB.Exec(`
		INSERT INTO workspaces (
			workspace_id, user_name, display_name, directory_id, ip_address,
			state, bundle_id, subnet_id, computer_name, running_mode,
			root_volume_size_gib, user_volume_size_gib, compute_type_name,
			created_at, terminated_at, last_known_user_connection_timestamp,
			aws_account_id, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
		ON CONFLICT (workspace_id) DO UPDATE SET
			user_name = $2,
			display_name = $3,
			directory_id = $4,
			ip_address = $5,
			state = $6,
			bundle_id = $7,
			subnet_id = $8,
			computer_name = $9,
			running_mode = $10,
			root_volume_size_gib = $11,
			user_volume_size_gib = $12,
			compute_type_name = $13,
			aws_account_id = $17,
			updated_at = NOW()
	`,
		ws.WorkspaceId,
		ws.UserName,
		"", // Display name not available in WorkspaceProperties
		ws.DirectoryId,
		ws.IpAddress,
		state,
		ws.BundleId,
		ws.SubnetId,
		ws.ComputerName,
		runningMode,
		rootVolSize,
		userVolSize,
		computeTypeName,
		createdAt,
		terminatedAt,
		lastConnection,
		accountIDPtr,
	)

	return err
}

// DescribeWorkspace gets a single workspace details from AWS
func (s *AWSService) DescribeWorkspace(ctx context.Context, workspaceID string) (*wstypes.Workspace, error) {
	cfg, err := s.GetAWSConfig(ctx)
	if err != nil {
		return nil, err
	}

	client := workspaces.NewFromConfig(cfg)
	input := &workspaces.DescribeWorkspacesInput{
		WorkspaceIds: []string{workspaceID},
	}

	result, err := client.DescribeWorkspaces(ctx, input)
	if err != nil {
		return nil, err
	}

	if len(result.Workspaces) == 0 {
		return nil, fmt.Errorf("workspace not found")
	}

	return &result.Workspaces[0], nil
}

// TestConnection tests the AWS connection
func (s *AWSService) TestConnection(ctx context.Context) error {
	cfg, err := s.GetAWSConfig(ctx)
	if err != nil {
		return err
	}

	client := workspaces.NewFromConfig(cfg)

	// Try to describe workspaces with limit 1
	input := &workspaces.DescribeWorkspacesInput{
		Limit: aws.Int32(1),
	}

	_, err = client.DescribeWorkspaces(ctx, input)
	return err
}

// SyncCloudTrail fetches CloudTrail events for WorkSpaces and stores them
func (s *AWSService) SyncCloudTrail(ctx context.Context) (int, error) {
	cfg, err := s.GetAWSConfig(ctx)
	if err != nil {
		return 0, err
	}

	// Create CloudTrail client
	client := cloudtrail.NewFromConfig(cfg)

	// Calculate time range (last 7 days)
	endTime := time.Now()
	startTime := endTime.Add(-7 * 24 * time.Hour)

	log.Println("Fetching CloudTrail events from AWS...")

	// Lookup events for WorkSpaces
	input := &cloudtrail.LookupEventsInput{
		StartTime: &startTime,
		EndTime:   &endTime,
		LookupAttributes: []cttypes.LookupAttribute{
			{
				AttributeKey:   cttypes.LookupAttributeKeyResourceType,
				AttributeValue: aws.String("AWS::WorkSpaces::Workspace"),
			},
		},
		MaxResults: aws.Int32(50),
	}

	count := 0
	paginator := cloudtrail.NewLookupEventsPaginator(client, input)

	for paginator.HasMorePages() {
		output, err := paginator.NextPage(ctx)
		if err != nil {
			log.Printf("Error fetching CloudTrail events: %v", err)
			break
		}

		for _, event := range output.Events {
			err := s.upsertCloudTrailEvent(&event)
			if err != nil {
				log.Printf("Failed to upsert CloudTrail event %s: %v", *event.EventId, err)
				continue
			}
			count++
		}
	}

	log.Printf("Successfully synced %d CloudTrail events", count)
	return count, nil
}

// upsertCloudTrailEvent inserts or updates a CloudTrail event
func (s *AWSService) upsertCloudTrailEvent(event *cttypes.Event) error {
	// Extract workspace ID from resources
	workspaceID := ""
	for _, resource := range event.Resources {
		if resource.ResourceType != nil && *resource.ResourceType == "AWS::WorkSpaces::Workspace" {
			if resource.ResourceName != nil {
				workspaceID = *resource.ResourceName
			}
			break
		}
	}

	// Marshal JSON fields
	userIdentityJSON, _ := json.Marshal(event.Username)
	requestParamsJSON := []byte("{}")
	if event.CloudTrailEvent != nil {
		// Parse CloudTrailEvent to extract request parameters
		var ctEvent map[string]interface{}
		if err := json.Unmarshal([]byte(*event.CloudTrailEvent), &ctEvent); err == nil {
			if reqParams, ok := ctEvent["requestParameters"]; ok {
				requestParamsJSON, _ = json.Marshal(reqParams)
			}
		}
	}
	responseElementsJSON := []byte("{}")

	ctEvent := &models.CloudTrailEvent{
		EventID:            aws.ToString(event.EventId),
		EventName:          aws.ToString(event.EventName),
		EventTime:          aws.ToTime(event.EventTime),
		EventSource:        aws.ToString(event.EventSource),
		Username:           aws.ToString(event.Username),
		UserIdentity:       userIdentityJSON,
		WorkspaceID:        workspaceID,
		RequestParameters:  requestParamsJSON,
		ResponseElements:   responseElementsJSON,
		EventRegion:        "us-east-1", // Default region
	}

	return models.InsertCloudTrailEvent(s.DB, ctEvent)
}

// SyncBillingData fetches cost data from AWS Cost Explorer
func (s *AWSService) SyncBillingData(ctx context.Context) (int, error) {
	cfg, err := s.GetAWSConfig(ctx)
	if err != nil {
		return 0, err
	}

	// Create Cost Explorer client
	client := costexplorer.NewFromConfig(cfg)

	// Calculate time range (last 30 days)
	endDate := time.Now().Format("2006-01-02")
	startDate := time.Now().Add(-30 * 24 * time.Hour).Format("2006-01-02")

	log.Println("Fetching billing data from AWS Cost Explorer...")

	// Get cost and usage
	input := &costexplorer.GetCostAndUsageInput{
		TimePeriod: &cetypes.DateInterval{
			Start: &startDate,
			End:   &endDate,
		},
		Granularity: cetypes.GranularityDaily,
		Metrics:     []string{"UnblendedCost", "UsageQuantity"},
		Filter: &cetypes.Expression{
			Dimensions: &cetypes.DimensionValues{
				Key:    cetypes.DimensionService,
				Values: []string{"Amazon WorkSpaces"},
			},
		},
		GroupBy: []cetypes.GroupDefinition{
			{
				Type: cetypes.GroupDefinitionTypeDimension,
				Key:  aws.String("USAGE_TYPE"),
			},
		},
	}

	result, err := client.GetCostAndUsage(ctx, input)
	if err != nil {
		return 0, fmt.Errorf("failed to get cost and usage: %w", err)
	}

	count := 0
	for _, resultByTime := range result.ResultsByTime {
		startDate, _ := time.Parse("2006-01-02", *resultByTime.TimePeriod.Start)
		endDate, _ := time.Parse("2006-01-02", *resultByTime.TimePeriod.End)

		for _, group := range resultByTime.Groups {
			usageType := ""
			if len(group.Keys) > 0 {
				usageType = group.Keys[0]
			}

			// Extract cost amount
			var amount float64
			if cost, ok := group.Metrics["UnblendedCost"]; ok && cost.Amount != nil {
				amount, _ = strconv.ParseFloat(*cost.Amount, 64)
			}

			// Extract workspace ID from usage type if possible
			workspaceID := extractWorkspaceIDFromUsageType(usageType)

			billingData := &models.BillingData{
				WorkspaceID: workspaceID,
				Service:     "Amazon WorkSpaces",
				UsageType:   usageType,
				StartDate:   startDate,
				EndDate:     endDate,
				Amount:      amount,
				Unit:        "USD",
			}

			if err := models.UpsertBillingData(s.DB, billingData); err != nil {
				log.Printf("Failed to upsert billing data: %v", err)
				continue
			}
			count++
		}
	}

	log.Printf("Successfully synced %d billing records", count)
	return count, nil
}

// extractWorkspaceIDFromUsageType attempts to extract workspace ID from usage type
func extractWorkspaceIDFromUsageType(usageType string) string {
	// AWS Cost Explorer doesn't directly provide workspace IDs in usage types
	// This is a placeholder - in production, you might need to correlate
	// with workspace tags or other metadata
	return ""
}

// CalculateUsageHours calculates monthly usage hours from workspace connection data
func (s *AWSService) CalculateUsageHours(ctx context.Context) (int, error) {
	// Get current month
	now := time.Now()
	currentMonth := now.Format("2006-01")

	log.Printf("Calculating usage hours for month: %s", currentMonth)

	// Get all active workspaces
	query := `
		SELECT workspace_id, created_at, terminated_at, state
		FROM workspaces
		WHERE state IN ('AVAILABLE', 'STOPPED', 'IMPAIRED')
	`

	rows, err := s.DB.Query(query)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var workspaceID string
		var createdAt, terminatedAt sql.NullTime
		var state string

		if err := rows.Scan(&workspaceID, &createdAt, &terminatedAt, &state); err != nil {
			continue
		}

		// Calculate hours for the month
		// Simple calculation: assume 720 hours per month (30 days * 24 hours)
		// In production, you would calculate based on actual connection logs from CloudTrail
		var usageHours float64

		if state == "AVAILABLE" {
			// Running 24/7
			usageHours = 720.0
		} else if state == "STOPPED" {
			// Stopped workspaces - minimal hours
			usageHours = 0.0
		} else {
			// Default assumption
			usageHours = 160.0 // ~40 hours per week
		}

		// Upsert usage data
		if err := models.UpsertWorkspaceUsage(s.DB, workspaceID, currentMonth, usageHours); err != nil {
			log.Printf("Failed to upsert usage for %s: %v", workspaceID, err)
			continue
		}
		count++
	}

	log.Printf("Successfully calculated usage for %d workspaces", count)
	return count, nil
}

// SyncActiveDirectoryUsers syncs user information from Active Directory
// SyncActiveDirectoryUsersFromServer syncs users from a specific LDAP server
func (s *AWSService) SyncActiveDirectoryUsersFromServer(ctx context.Context, serverID int) (int, error) {
	// Get LDAP server config
	server, err := models.GetLDAPServerByID(s.DB, serverID)
	if err != nil {
		return 0, fmt.Errorf("failed to get LDAP server: %w", err)
	}

	if !server.IsActive {
		return 0, fmt.Errorf("LDAP server is not active")
	}

	log.Printf("Connecting to LDAP server: %s (%s)", server.Name, server.ServerURL)

	// Connect to LDAP
	l, err := ldap.DialURL(server.ServerURL)
	if err != nil {
		return 0, fmt.Errorf("failed to connect to LDAP: %w", err)
	}
	defer l.Close()

	// Bind with credentials
	err = l.Bind(server.BindUsername, server.BindPassword)
	if err != nil {
		return 0, fmt.Errorf("failed to bind to LDAP: %w", err)
	}

	// Get all workspace users
	query := "SELECT DISTINCT user_name FROM workspaces WHERE user_name IS NOT NULL AND user_name != ''"
	rows, err := s.DB.Query(query)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var userName string
		if err := rows.Scan(&userName); err != nil {
			continue
		}

		// Replace {username} in search filter
		searchFilter := server.SearchFilter
		if searchFilter == "" {
			searchFilter = "(sAMAccountName={username})"
		}
		// Replace {username} placeholder with actual escaped username
		searchFilter = strings.ReplaceAll(searchFilter, "{username}", ldap.EscapeFilter(userName))

		// Search for user in LDAP
		searchRequest := ldap.NewSearchRequest(
			server.BaseDN,
			ldap.ScopeWholeSubtree, ldap.NeverDerefAliases, 0, 0, false,
			searchFilter,
			[]string{"displayName", "mail", "department", "title", "manager"},
			nil,
		)

		sr, err := l.Search(searchRequest)
		if err != nil {
			log.Printf("Failed to search for user %s: %v", userName, err)
			continue
		}

		if len(sr.Entries) == 0 {
			log.Printf("User %s not found in LDAP server %s", userName, server.Name)
			continue
		}

		// Get user attributes
		entry := sr.Entries[0]
		displayName := entry.GetAttributeValue("displayName")
		email := entry.GetAttributeValue("mail")

		// Update workspace with user info (assuming you have a function for this)
		// For now, just log the information
		log.Printf("Found user %s: %s <%s>", userName, displayName, email)
		// TODO: Update workspace or user table with this information
		count++
	}

	// Update last sync timestamp for the server
	models.UpdateLDAPServerLastSync(s.DB, serverID)

	log.Printf("Successfully synced %d users from LDAP server %s", count, server.Name)
	return count, nil
}

// SyncAllLDAPServers syncs users from all active LDAP servers
func (s *AWSService) SyncAllLDAPServers(ctx context.Context) (int, error) {
	// Get all active LDAP servers
	servers, err := models.GetAllLDAPServers(s.DB)
	if err != nil {
		return 0, fmt.Errorf("failed to get LDAP servers: %w", err)
	}

	totalCount := 0
	for _, server := range servers {
		if !server.IsActive || server.Status == "error" {
			log.Printf("Skipping inactive or error LDAP server: %s", server.Name)
			continue
		}

		count, err := s.SyncActiveDirectoryUsersFromServer(ctx, server.ID)
		if err != nil {
			log.Printf("Failed to sync LDAP server %s: %v", server.Name, err)
			models.UpdateLDAPServerStatus(s.DB, server.ID, "error")
			continue
		}

		totalCount += count
		models.UpdateLDAPServerStatus(s.DB, server.ID, "connected")
	}

	log.Printf("Successfully synced %d users across all LDAP servers", totalCount)
	return totalCount, nil
}

func (s *AWSService) SyncActiveDirectoryUsers(ctx context.Context) (int, error) {
	// Check if any LDAP servers are configured
	servers, err := models.GetAllLDAPServers(s.DB)
	if err == nil && len(servers) > 0 {
		// Use the new multi-server sync
		return s.SyncAllLDAPServers(ctx)
	}

	// Fallback to legacy single-server sync from settings
	adEnabled, err := models.GetSetting(s.DB, "ad.sync_enabled")
	if err != nil || adEnabled.Value != "true" {
		log.Println("Active Directory sync is disabled")
		return 0, nil
	}

	serverURL, err := models.GetSetting(s.DB, "ad.server_url")
	if err != nil || serverURL.Value == "" {
		return 0, fmt.Errorf("AD server URL not configured")
	}

	baseDN, err := models.GetSetting(s.DB, "ad.base_dn")
	if err != nil || baseDN.Value == "" {
		return 0, fmt.Errorf("AD base DN not configured")
	}

	bindUsername, err := models.GetSetting(s.DB, "ad.bind_username")
	if err != nil || bindUsername.Value == "" {
		return 0, fmt.Errorf("AD bind username not configured")
	}

	bindPassword, err := models.GetSetting(s.DB, "ad.bind_password")
	if err != nil || bindPassword.Value == "" {
		return 0, fmt.Errorf("AD bind password not configured")
	}

	log.Printf("Connecting to Active Directory: %s", serverURL.Value)

	// Connect to LDAP
	l, err := ldap.DialURL(serverURL.Value)
	if err != nil {
		return 0, fmt.Errorf("failed to connect to AD: %w", err)
	}
	defer l.Close()

	// Bind with credentials
	err = l.Bind(bindUsername.Value, bindPassword.Value)
	if err != nil {
		return 0, fmt.Errorf("failed to bind to AD: %w", err)
	}

	// Get all workspace users
	query := "SELECT DISTINCT user_name FROM workspaces WHERE user_name IS NOT NULL AND user_name != ''"
	rows, err := s.DB.Query(query)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var userName string
		if err := rows.Scan(&userName); err != nil {
			continue
		}

		// Search for user in AD
		searchRequest := ldap.NewSearchRequest(
			baseDN.Value,
			ldap.ScopeWholeSubtree, ldap.NeverDerefAliases, 0, 0, false,
			fmt.Sprintf("(sAMAccountName=%s)", ldap.EscapeFilter(userName)),
			[]string{"displayName", "mail", "department", "title", "manager"},
			nil,
		)

		sr, err := l.Search(searchRequest)
		if err != nil {
			log.Printf("Failed to search for user %s: %v", userName, err)
			continue
		}

		if len(sr.Entries) == 0 {
			log.Printf("User %s not found in AD", userName)
			continue
		}

		entry := sr.Entries[0]

		// Update workspace with AD info
		updateQuery := `
			UPDATE workspaces
			SET ad_full_name = $1,
			    ad_email = $2,
			    ad_department = $3,
			    ad_job_title = $4,
			    ad_manager = $5,
			    ad_last_sync = CURRENT_TIMESTAMP
			WHERE user_name = $6
		`

		_, err = s.DB.Exec(updateQuery,
			entry.GetAttributeValue("displayName"),
			entry.GetAttributeValue("mail"),
			entry.GetAttributeValue("department"),
			entry.GetAttributeValue("title"),
			entry.GetAttributeValue("manager"),
			userName,
		)

		if err != nil {
			log.Printf("Failed to update AD info for %s: %v", userName, err)
			continue
		}

		count++
	}

	log.Printf("Successfully synced AD info for %d users", count)
	return count, nil
}
