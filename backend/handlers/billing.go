package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type BillingHandler struct {
	DB *sql.DB
}

// ListBilling returns billing/cost data with filtering
func (h *BillingHandler) ListBilling(c *gin.Context) {
	// Parse pagination
	limitStr := c.DefaultQuery("limit", "50")
	offsetStr := c.DefaultQuery("offset", "0")

	limit, _ := strconv.Atoi(limitStr)
	offset, _ := strconv.Atoi(offsetStr)

	// Build filters
	filters := make(map[string]interface{})

	if workspaceID := c.Query("workspace_id"); workspaceID != "" {
		filters["workspace_id"] = workspaceID
	}

	if userName := c.Query("user_name"); userName != "" {
		filters["user_name"] = userName
	}

	if startDate := c.Query("start_date"); startDate != "" {
		filters["start_date"] = startDate
	}

	if endDate := c.Query("end_date"); endDate != "" {
		filters["end_date"] = endDate
	}

	if service := c.Query("service"); service != "" {
		filters["service"] = service
	}

	// Get billing data
	billing, total, err := h.getBillingDataWithUserInfo(filters, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve billing data"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":   billing,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// getBillingDataWithUserInfo retrieves billing data joined with workspace user info
func (h *BillingHandler) getBillingDataWithUserInfo(filters map[string]interface{}, limit, offset int) ([]map[string]interface{}, int, error) {
	baseQuery := `
		SELECT b.id, b.workspace_id, b.service, b.usage_type, b.start_date, b.end_date,
		       b.amount, b.unit, b.created_at, w.user_name, w.ad_full_name
		FROM billing_data b
		LEFT JOIN workspaces w ON b.workspace_id = w.workspace_id
		WHERE 1=1
	`

	countQuery := "SELECT COUNT(*) FROM billing_data b LEFT JOIN workspaces w ON b.workspace_id = w.workspace_id WHERE 1=1"
	args := []interface{}{}
	argPos := 1

	// Apply filters
	if workspaceID, ok := filters["workspace_id"].(string); ok && workspaceID != "" {
		filterClause := fmt.Sprintf(" AND b.workspace_id = $%d", argPos)
		baseQuery += filterClause
		countQuery += filterClause
		args = append(args, workspaceID)
		argPos++
	}

	if userName, ok := filters["user_name"].(string); ok && userName != "" {
		filterClause := fmt.Sprintf(" AND w.user_name ILIKE $%d", argPos)
		baseQuery += filterClause
		countQuery += filterClause
		args = append(args, "%"+userName+"%")
		argPos++
	}

	if startDate, ok := filters["start_date"].(string); ok && startDate != "" {
		filterClause := fmt.Sprintf(" AND b.start_date >= $%d", argPos)
		baseQuery += filterClause
		countQuery += filterClause
		args = append(args, startDate)
		argPos++
	}

	if endDate, ok := filters["end_date"].(string); ok && endDate != "" {
		filterClause := fmt.Sprintf(" AND b.end_date <= $%d", argPos)
		baseQuery += filterClause
		countQuery += filterClause
		args = append(args, endDate)
		argPos++
	}

	if service, ok := filters["service"].(string); ok && service != "" {
		filterClause := fmt.Sprintf(" AND b.service = $%d", argPos)
		baseQuery += filterClause
		countQuery += filterClause
		args = append(args, service)
		argPos++
	}

	// Get total count
	var total int
	err := h.DB.QueryRow(countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Add pagination
	baseQuery += fmt.Sprintf(" ORDER BY b.start_date DESC LIMIT $%d OFFSET $%d", argPos, argPos+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(baseQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	billing := []map[string]interface{}{}
	for rows.Next() {
		var id int
		var workspaceID, service, usageType, unit string
		var userName, adFullName sql.NullString
		var startDate, endDate, createdAt interface{}
		var amount float64

		err := rows.Scan(&id, &workspaceID, &service, &usageType, &startDate, &endDate,
			&amount, &unit, &createdAt, &userName, &adFullName)
		if err != nil {
			return nil, 0, err
		}

		displayName := userName.String
		if adFullName.Valid && adFullName.String != "" {
			displayName = adFullName.String
		}

		billing = append(billing, map[string]interface{}{
			"id":           id,
			"workspace_id": workspaceID,
			"service":      service,
			"usage_type":   usageType,
			"start_date":   startDate,
			"end_date":     endDate,
			"amount":       amount,
			"unit":         unit,
			"currency":     "USD",
			"created_at":   createdAt,
			"user_name":    userName.String,
			"full_name":    displayName,
		})
	}

	return billing, total, nil
}

// ExportBilling exports billing data to CSV or Excel
func (h *BillingHandler) ExportBilling(c *gin.Context) {
	format := c.DefaultQuery("format", "csv")

	// Build filters
	filters := make(map[string]interface{})

	if workspaceID := c.Query("workspace_id"); workspaceID != "" {
		filters["workspace_id"] = workspaceID
	}

	if userName := c.Query("user_name"); userName != "" {
		filters["user_name"] = userName
	}

	if startDate := c.Query("start_date"); startDate != "" {
		filters["start_date"] = startDate
	}

	if endDate := c.Query("end_date"); endDate != "" {
		filters["end_date"] = endDate
	}

	// Get all billing data (no pagination for export)
	billing, _, err := h.getBillingDataWithUserInfo(filters, 10000, 0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve billing data"})
		return
	}

	// Export using the export handler
	ExportData(c, billing, format, "billing")
}
