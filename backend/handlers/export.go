package handlers

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"reflect"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
)

// ExportData exports data to CSV or Excel format
func ExportData(c *gin.Context, data interface{}, format, filename string) {
	switch format {
	case "xlsx", "excel":
		exportExcel(c, data, filename)
	case "csv":
		exportCSV(c, data, filename)
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid format. Use 'csv' or 'xlsx'"})
	}
}

// exportCSV exports data to CSV format
func exportCSV(c *gin.Context, data interface{}, filename string) {
	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s_%s.csv", filename, time.Now().Format("2006-01-02")))

	writer := csv.NewWriter(c.Writer)
	defer writer.Flush()

	// Convert data to []map[string]interface{} for processing
	rows, headers := convertToRows(data)

	// Write headers
	if err := writer.Write(headers); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to write CSV headers"})
		return
	}

	// Write data rows
	for _, row := range rows {
		record := make([]string, len(headers))
		for i, header := range headers {
			if val, ok := row[header]; ok {
				record[i] = formatValue(val)
			}
		}
		if err := writer.Write(record); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to write CSV row"})
			return
		}
	}
}

// exportExcel exports data to Excel format
func exportExcel(c *gin.Context, data interface{}, filename string) {
	f := excelize.NewFile()
	defer f.Close()

	sheetName := "Sheet1"
	index, _ := f.NewSheet(sheetName)
	f.SetActiveSheet(index)

	// Convert data to rows
	rows, headers := convertToRows(data)

	// Write headers
	for i, header := range headers {
		cell := fmt.Sprintf("%s1", getExcelColumn(i))
		f.SetCellValue(sheetName, cell, header)
	}

	// Apply header styling
	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Size: 12},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"#4472C4"}, Pattern: 1},
		Font: &excelize.Font{Color: "#FFFFFF", Bold: true},
	})
	f.SetCellStyle(sheetName, "A1", fmt.Sprintf("%s1", getExcelColumn(len(headers)-1)), headerStyle)

	// Write data rows
	for rowIdx, row := range rows {
		for colIdx, header := range headers {
			cell := fmt.Sprintf("%s%d", getExcelColumn(colIdx), rowIdx+2)
			if val, ok := row[header]; ok {
				f.SetCellValue(sheetName, cell, formatValue(val))
			}
		}
	}

	// Auto-fit columns
	for i := range headers {
		col := getExcelColumn(i)
		f.SetColWidth(sheetName, col, col, 15)
	}

	// Set response headers
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s_%s.xlsx", filename, time.Now().Format("2006-01-02")))

	// Write to response
	if err := f.Write(c.Writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate Excel file"})
	}
}

// convertToRows converts various data types to []map[string]interface{} and extracts headers
func convertToRows(data interface{}) ([]map[string]interface{}, []string) {
	rows := []map[string]interface{}{}
	headers := []string{}
	headersMap := make(map[string]bool)

	// Use reflection to handle different data types
	val := reflect.ValueOf(data)

	// Handle slices
	if val.Kind() == reflect.Slice {
		for i := 0; i < val.Len(); i++ {
			item := val.Index(i).Interface()

			// Convert to map
			rowMap := structToMap(item)
			rows = append(rows, rowMap)

			// Collect headers
			for key := range rowMap {
				if !headersMap[key] {
					headers = append(headers, key)
					headersMap[key] = true
				}
			}
		}
	}

	return rows, headers
}

// structToMap converts a struct or map to map[string]interface{}
func structToMap(item interface{}) map[string]interface{} {
	result := make(map[string]interface{})

	// If already a map, return it
	if m, ok := item.(map[string]interface{}); ok {
		return m
	}

	// Try to marshal and unmarshal via JSON (handles struct tags)
	jsonBytes, err := json.Marshal(item)
	if err == nil {
		json.Unmarshal(jsonBytes, &result)
	}

	return result
}

// formatValue formats a value for CSV/Excel output
func formatValue(val interface{}) string {
	if val == nil {
		return ""
	}

	switch v := val.(type) {
	case time.Time:
		return v.Format("2006-01-02 15:04:05")
	case []byte:
		// Handle JSON fields
		return string(v)
	case float64:
		return fmt.Sprintf("%.2f", v)
	case bool:
		if v {
			return "Yes"
		}
		return "No"
	default:
		return fmt.Sprintf("%v", v)
	}
}

// getExcelColumn converts column index to Excel column letter (0 -> A, 1 -> B, etc.)
func getExcelColumn(index int) string {
	result := ""
	for index >= 0 {
		result = string(rune('A'+(index%26))) + result
		index = index/26 - 1
	}
	return result
}

// ExportWorkspacesHandler adds export functionality to workspaces handler
func (h *WorkspacesHandler) ExportWorkspaces(c *gin.Context) {
	format := c.DefaultQuery("format", "csv")

	// Build filters
	filters := make(map[string]interface{})
	if userName := c.Query("user_name"); userName != "" {
		filters["user_name"] = userName
	}
	if state := c.Query("state"); state != "" {
		filters["state"] = state
	}
	if runningMode := c.Query("running_mode"); runningMode != "" {
		filters["running_mode"] = runningMode
	}
	if bundleID := c.Query("bundle_id"); bundleID != "" {
		filters["bundle_id"] = bundleID
	}

	// Get all workspaces (no pagination for export)
	workspaces, _, err := models.ListWorkspaces(h.DB, filters, 10000, 0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve workspaces"})
		return
	}

	// Export using the export handler
	ExportData(c, workspaces, format, "workspaces")
}
