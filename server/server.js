const express = require('express');
const https = require('https');
const cors = require('cors');
const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Helper function to fetch from dummyjson.com
function fetchFromDummyJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

// Helper function to get field value from nested object
function getFieldValue(obj, field) {
  return field.split('.').reduce((o, p) => o?.[p], obj);
}

// Helper function to apply filters
function applyFilters(data, filters) {
  if (!filters || filters.length === 0) {
    return data;
  }
  
  return data.filter(item => {
    return filters.every(filter => {
      const value = getFieldValue(item, filter.field);
      const filterValue = filter.value;
      
      // Normalize operator to handle case variations and remove spaces
      const operator = String(filter.operator || '').toLowerCase().replace(/\s+/g, '');
      
      switch (operator) {
        case 'equals':
          return value != null && String(value) === String(filterValue);
        case 'notequals':
        case 'notequal':
          return value == null || String(value) !== String(filterValue);
        case 'contains':
          return value != null && String(value).toLowerCase().includes(String(filterValue).toLowerCase());
        case 'notcontains':
        case 'notcontain':
          return value == null || !String(value).toLowerCase().includes(String(filterValue).toLowerCase());
        case 'startswith':
        case 'startwith':
          return value != null && String(value).toLowerCase().startsWith(String(filterValue).toLowerCase());
        case 'endswith':
        case 'endwith':
          return value != null && String(value).toLowerCase().endsWith(String(filterValue).toLowerCase());
        case 'greaterthan':
          return Number(value) > Number(filterValue);
        case 'greaterthanorequal':
          return Number(value) >= Number(filterValue);
        case 'lessthan':
          return Number(value) < Number(filterValue);
        case 'lessthanorequal':
          return Number(value) <= Number(filterValue);
        case 'isnull':
          return value == null || value === undefined || value === '';
        case 'isnotnull':
          return value != null && value !== undefined && value !== '';
        default:
          console.warn('[SERVER] Unknown filter operator:', filter.operator, '- defaulting to true');
          return true;
      }
    });
  });
}

// Helper function to apply sorting
function applySorting(data, sort) {
  if (!sort || sort.length === 0) {
    return data;
  }
  
  return [...data].sort((a, b) => {
    for (const sortConfig of sort) {
      if (sortConfig.direction === 'None') continue;
      
      const aVal = getFieldValue(a, sortConfig.field);
      const bVal = getFieldValue(b, sortConfig.field);
      
      let cmp = 0;
      if (aVal > bVal) cmp = 1;
      else if (aVal < bVal) cmp = -1;
      
      if (sortConfig.direction === 'Desc') cmp *= -1;
      if (cmp !== 0) return cmp;
    }
    return 0;
  });
}

// Endpoint: GET /api/products/groups
// Returns only unique group values and their counts (with pagination)
app.get('/api/products/groups', async (req, res) => {
  try {
    const { groupField, sortBy, filters, skip, limit, search, searchFields } = req.query;
    
    if (!groupField) {
      return res.status(400).json({ error: 'groupField parameter is required' });
    }
    
    // Parse pagination parameters
    const skipNum = parseInt(skip) || 0;
    const limitNum = parseInt(limit) || 10;
    
    // Ensure limit is a positive number
    const validLimit = limitNum > 0 ? limitNum : 10;
    
    console.log('[SERVER] GROUP_METADATA API called:', { groupField, sortBy, filters, skip: skipNum, limit: validLimit, search, originalLimit: limit });
    
    // Fetch all products from dummyjson.com (limit 100 for demo)
    const url = 'https://dummyjson.com/products?limit=100&skip=0';
    const response = await fetchFromDummyJson(url);
    const allProducts = response.products || [];
    
    // Parse filters if provided
    let parsedFilters = [];
    if (filters) {
      try {
        parsedFilters = JSON.parse(filters);
      } catch (e) {
        console.warn('[SERVER] Could not parse filters:', e);
      }
    }
    
    // Parse sort if provided
    let parsedSort = [];
    if (sortBy) {
      try {
        parsedSort = JSON.parse(sortBy);
      } catch (e) {
        console.warn('[SERVER] Could not parse sortBy:', e);
      }
    }
    
    // Parse search fields if provided
    let parsedSearchFields = [];
    if (searchFields) {
      try {
        parsedSearchFields = JSON.parse(searchFields);
      } catch (e) {
        console.warn('[SERVER] Could not parse searchFields:', e);
      }
    }
    
    // Apply global search first (before filters)
    let filteredData = applyGlobalSearch(allProducts, search, parsedSearchFields);
    
    // Apply filters
    filteredData = applyFilters(filteredData, parsedFilters);
    
    // Apply sorting
    filteredData = applySorting(filteredData, parsedSort);
    
    // Group data by field value
    const grouped = new Map();
    filteredData.forEach(item => {
      const value = getFieldValue(item, groupField);
      const key = value != null ? String(value) : '(null)';
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push(item);
    });
    
    // Build metadata array (only unique values and counts)
    const metadata = [];
    grouped.forEach((items, key) => {
      metadata.push({
        value: key === '(null)' ? null : key,
        key: key,
        count: items.length
      });
    });
    
    // Sort metadata
    if (parsedSort && parsedSort.length > 0 && parsedSort[0].field === groupField) {
      metadata.sort((a, b) => {
        if (parsedSort[0].direction === 'Desc') {
          return b.key.localeCompare(a.key);
        }
        return a.key.localeCompare(b.key);
      });
    } else {
      metadata.sort((a, b) => a.key.localeCompare(b.key));
    }
    
    // Get total count before pagination
    const totalGroups = metadata.length;
    
    // Apply pagination to metadata
    const paginatedMetadata = metadata.slice(skipNum, skipNum + validLimit);
    
    console.log('[SERVER] GROUP_METADATA response:', {
      totalProducts: allProducts.length,
      afterSearch: search ? applyGlobalSearch(allProducts, search, parsedSearchFields).length : allProducts.length,
      afterFilters: filteredData.length,
      totalGroups: totalGroups,
      returnedGroups: paginatedMetadata.length,
      skip: skipNum,
      limit: validLimit,
      requestedLimit: limitNum,
      sampleGroups: paginatedMetadata.slice(0, 3).map(g => `${g.key}(${g.count})`).join(', ')
    });
    
    // Debug: Log first few filtered items to verify filter is working
    if (parsedFilters.length > 0) {
      console.log('[SERVER] Filter debug - First 3 filtered items:', filteredData.slice(0, 3).map(item => ({
        category: item.category,
        title: item.title?.substring(0, 20)
      })));
    }
    
    // Return paginated metadata with total count
    res.json({
      groups: paginatedMetadata,
      total: totalGroups,
      skip: skipNum,
      limit: validLimit
    });
    
  } catch (error) {
    console.error('[SERVER] Error in /api/products/groups:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint: GET /api/products/children
// Returns only children for a specific group value
app.get('/api/products/children', async (req, res) => {
  try {
    const { groupField, groupValue, sortBy, filters, search, searchFields } = req.query;
    
    if (!groupField || groupValue === undefined) {
      return res.status(400).json({ error: 'groupField and groupValue parameters are required' });
    }
    
    console.log('[SERVER] GROUP_CHILDREN API called:', { groupField, groupValue, sortBy, filters, search });
    
    // Fetch all products from dummyjson.com
    const url = 'https://dummyjson.com/products?limit=100&skip=0';
    const response = await fetchFromDummyJson(url);
    const allProducts = response.products || [];
    
    // Parse filters if provided
    let parsedFilters = [];
    if (filters) {
      try {
        parsedFilters = JSON.parse(filters);
      } catch (e) {
        console.warn('[SERVER] Could not parse filters:', e);
      }
    }
    
    // Parse sort if provided
    let parsedSort = [];
    if (sortBy) {
      try {
        parsedSort = JSON.parse(sortBy);
      } catch (e) {
        console.warn('[SERVER] Could not parse sortBy:', e);
      }
    }
    
    // Parse search fields if provided
    let parsedSearchFields = [];
    if (searchFields) {
      try {
        parsedSearchFields = JSON.parse(searchFields);
      } catch (e) {
        console.warn('[SERVER] Could not parse searchFields:', e);
      }
    }
    
    // Apply global search first (before filters)
    let processedData = applyGlobalSearch(allProducts, search, parsedSearchFields);
    
    // Add group filter
    const groupFilter = {
      field: groupField,
      operator: 'Equals',
      value: groupValue === '(null)' || groupValue === '' ? null : groupValue
    };
    const allFilters = [...parsedFilters, groupFilter];
    
    // Apply filters (includes group filter)
    let filteredData = applyFilters(processedData, allFilters);
    
    // Apply sorting
    filteredData = applySorting(filteredData, parsedSort);
    
    console.log('[SERVER] GROUP_CHILDREN response:', {
      totalProducts: allProducts.length,
      childrenCount: filteredData.length,
      groupField,
      groupValue
    });
    
    // Return only children for this specific group
    res.json({
      products: filteredData,
      total: filteredData.length
    });
    
  } catch (error) {
    console.error('[SERVER] Error in /api/products/children:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to apply global search
function applyGlobalSearch(data, searchTerm, searchFields = []) {
  if (!searchTerm || !searchTerm.trim()) {
    return data;
  }
  
  const searchLower = searchTerm.toLowerCase().trim();
  
  // If no specific fields provided, search in common text fields
  const fieldsToSearch = searchFields.length > 0 
    ? searchFields 
    : ['title', 'name', 'description', 'category', 'brand'];
  
  return data.filter(item => {
    return fieldsToSearch.some(field => {
      const value = getFieldValue(item, field);
      if (value == null) return false;
      return String(value).toLowerCase().includes(searchLower);
    });
  });
}

// Endpoint: GET /api/products
// Main endpoint for fetching products with pagination, filtering, sorting, and search
app.get('/api/products', async (req, res) => {
  try {
    const { skip, limit, sortBy, filters, search, searchFields } = req.query;
    
    // Parse pagination parameters
    const skipNum = parseInt(skip) || 0;
    const limitNum = parseInt(limit) || 10;
    const validLimit = limitNum > 0 ? limitNum : 10;
    
    console.log('[SERVER] PRODUCTS API called:', { 
      skip: skipNum, 
      limit: validLimit, 
      sortBy, 
      filters, 
      search,
      searchFields 
    });
    
    // Fetch all products from dummyjson.com (limit 100 for demo)
    const url = 'https://dummyjson.com/products?limit=100&skip=0';
    const response = await fetchFromDummyJson(url);
    const allProducts = response.products || [];
    
    // Parse filters if provided
    let parsedFilters = [];
    if (filters) {
      try {
        parsedFilters = JSON.parse(filters);
      } catch (e) {
        console.warn('[SERVER] Could not parse filters:', e);
      }
    }
    
    // Parse sort if provided
    let parsedSort = [];
    if (sortBy) {
      try {
        parsedSort = JSON.parse(sortBy);
      } catch (e) {
        console.warn('[SERVER] Could not parse sortBy:', e);
      }
    }
    
    // Parse search fields if provided
    let parsedSearchFields = [];
    if (searchFields) {
      try {
        parsedSearchFields = JSON.parse(searchFields);
      } catch (e) {
        console.warn('[SERVER] Could not parse searchFields:', e);
      }
    }
    
    // Apply global search first (before filters)
    let processedData = applyGlobalSearch(allProducts, search, parsedSearchFields);
    
    // Apply filters
    processedData = applyFilters(processedData, parsedFilters);
    
    // Get total count after filtering and searching (before sorting and pagination)
    const total = processedData.length;
    
    // Apply sorting
    processedData = applySorting(processedData, parsedSort);
    
    // Apply pagination
    const paginatedData = processedData.slice(skipNum, skipNum + validLimit);
    
    console.log('[SERVER] PRODUCTS API response:', {
      totalProducts: allProducts.length,
      afterSearchAndFilters: total,
      returnedProducts: paginatedData.length,
      skip: skipNum,
      limit: validLimit
    });
    
    // Return paginated data with total count
    res.json({
      products: paginatedData,
      total: total,
      skip: skipNum,
      limit: validLimit,
      hasMore: (skipNum + validLimit) < total
    });
    
  } catch (error) {
    console.error('[SERVER] Error in /api/products:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`[SERVER] Server running on http://localhost:${PORT}`);
  console.log(`[SERVER] Products endpoint: http://localhost:${PORT}/api/products`);
  console.log(`[SERVER] Group metadata endpoint: http://localhost:${PORT}/api/products/groups`);
  console.log(`[SERVER] Group children endpoint: http://localhost:${PORT}/api/products/children`);
});
