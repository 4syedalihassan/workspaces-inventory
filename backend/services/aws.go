package services

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/4syedalihassan/workspaces-inventory/models"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/workspaces"
	wstypes "github.com/aws/aws-sdk-go-v2/service/workspaces/types"
)

type AWSService struct {
	DB *sql.DB
}

// GetAWSConfig creates AWS config from database settings
func (s *AWSService) GetAWSConfig(ctx context.Context) (aws.Config, error) {
	// Get credentials from database
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

// SyncWorkSpaces fetches all WorkSpaces from AWS and stores them
func (s *AWSService) SyncWorkSpaces(ctx context.Context) (int, error) {
	cfg, err := s.GetAWSConfig(ctx)
	if err != nil {
		return 0, err
	}

	// Create WorkSpaces client
	client := workspaces.NewFromConfig(cfg)

	// Describe all workspaces
	log.Println("Fetching WorkSpaces from AWS...")
	input := &workspaces.DescribeWorkspacesInput{}
	result, err := client.DescribeWorkspaces(ctx, input)
	if err != nil {
		return 0, fmt.Errorf("failed to describe workspaces: %w", err)
	}

	count := 0
	for _, ws := range result.Workspaces {
		// Upsert workspace
		err := s.upsertWorkspace(ws)
		if err != nil {
			log.Printf("Failed to upsert workspace %s: %v", *ws.WorkspaceId, err)
			continue
		}
		count++
	}

	log.Printf("Successfully synced %d workspaces", count)
	return count, nil
}

// upsertWorkspace inserts or updates a workspace in the database
func (s *AWSService) upsertWorkspace(ws wstypes.Workspace) error {
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
	st := string(ws.State)
	state = &st

	_, err := s.DB.Exec(`
		INSERT INTO workspaces (
			workspace_id, user_name, display_name, directory_id, ip_address,
			state, bundle_id, subnet_id, computer_name, running_mode,
			root_volume_size_gib, user_volume_size_gib, compute_type_name,
			created_at, terminated_at, last_known_user_connection_timestamp,
			updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
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
