export const parseCSV = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const csv = event.target.result;
        const lines = csv.split('\n');
        const results = [];
        
        // Skip empty lines and find the header row
        let headerRow = 0;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].trim()) {
            headerRow = i;
            break;
          }
        }
        
        const headers = lines[headerRow].split(',').map(h => h.trim().toLowerCase());
        
        // Validate headers - we need at least 2 columns
        if (headers.length < 2) {
          reject(new Error('CSV must have at least 2 columns for URL comparison'));
          return;
        }
        
        // Find URL columns (look for common patterns)
        let urlACol = -1;
        let urlBCol = -1;
        
        // Try to find columns with URL-related names
        for (let i = 0; i < headers.length; i++) {
          const header = headers[i];
          if (header.includes('url') || header.includes('site') || header.includes('website')) {
            if (urlACol === -1) {
              urlACol = i;
            } else if (urlBCol === -1) {
              urlBCol = i;
            }
          }
        }
        
        // If we couldn't find URL columns, use first two columns
        if (urlACol === -1) urlACol = 0;
        if (urlBCol === -1) urlBCol = 1;
        
        // Ensure we have different columns
        if (urlACol === urlBCol) {
          urlBCol = Math.min(urlBCol + 1, headers.length - 1);
        }
        
        console.log(`Using columns: ${headers[urlACol]} (${urlACol}) and ${headers[urlBCol]} (${urlBCol})`);
        
        // Parse data rows
        for (let i = headerRow + 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          // Handle quoted values and commas within quotes
          const values = parseCSVLine(line);
          
          if (values.length >= Math.max(urlACol, urlBCol) + 1) {
            const urlA = values[urlACol]?.trim();
            const urlB = values[urlBCol]?.trim();
            
            // Skip rows with empty URLs
            if (urlA && urlB) {
              // Basic URL validation
              try {
                new URL(urlA);
                new URL(urlB);
                
                results.push({
                  urlA,
                  urlB,
                  row: i + 1,
                  originalData: values
                });
              } catch (e) {
                console.warn(`Invalid URLs in row ${i + 1}: ${urlA}, ${urlB}`);
              }
            }
          }
        }
        
        if (results.length === 0) {
          reject(new Error('No valid URL pairs found in CSV file'));
          return;
        }
        
        resolve({
          comparisons: results,
          headers: headers,
          totalRows: results.length,
          columns: {
            urlA: { index: urlACol, name: headers[urlACol] },
            urlB: { index: urlBCol, name: headers[urlBCol] }
          }
        });
        
      } catch (error) {
        reject(new Error(`Failed to parse CSV: ${error.message}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read CSV file'));
    };
    
    reader.readAsText(file);
  });
};

// Helper function to parse CSV lines with proper quote handling
const parseCSVLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add the last field
  result.push(current);
  
  return result;
};

// Generate CSV template
export const generateCSVTemplate = () => {
  const template = `Original Site URL,Migrated Site URL,Description
https://example.com,https://example2.com,Compare homepage designs
https://example.com/about,https://example2.com/about,Compare about pages
https://example.com/contact,https://example2.com/contact,Compare contact pages`;
  
  const blob = new Blob([template], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = 'url-comparison-template.csv';
  link.click();
  
  URL.revokeObjectURL(url);
};

// Validate CSV file before upload
export const validateCSVFile = (file) => {
  const errors = [];
  
  // Check file type
  if (!file.name.toLowerCase().endsWith('.csv')) {
    errors.push('File must be a CSV file (.csv extension)');
  }
  
  // Check file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    errors.push('File size must be less than 5MB');
  }
  
  return errors;
};
