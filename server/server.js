const express = require('express');
const https = require('https');
const cors = require('cors');
const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Helper function to add delay (for testing loading indicators)
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

// Endpoint: GET /api/data/groups
// Returns only unique group values and their counts (with pagination)
app.get('/api/data/groups', async (req, res) => {
  try {
    // Add 3 second delay for testing loading indicator
    await delay(3000);
    
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
    
    // Fetch all data from dummyjson.com (limit 100 for demo)
    const url = 'https://dummyjson.com/products?limit=100&skip=0';
    const response = await fetchFromDummyJson(url);
    const allData = response.products || [];
    
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
    let filteredData = applyGlobalSearch(allData, search, parsedSearchFields);
    
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
      totalItems: allData.length,
      afterSearch: search ? applyGlobalSearch(allData, search, parsedSearchFields).length : allData.length,
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
    console.error('[SERVER] Error in /api/data/groups:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint: GET /api/data/children
// Returns only children for a specific group value
app.get('/api/data/children', async (req, res) => {
  try {
    // Add 3 second delay for testing loading indicator
    await delay(3000);
    
    const { groupField, groupValue, sortBy, filters, search, searchFields, skip, limit } = req.query;
    
    if (!groupField || groupValue === undefined) {
      return res.status(400).json({ error: 'groupField and groupValue parameters are required' });
    }
    
    // Parse pagination parameters
    const skipNum = parseInt(skip) || 0;
    const limitNum = parseInt(limit) || 10;
    const validLimit = limitNum > 0 ? limitNum : 10;
    
    console.log('[SERVER] GROUP_CHILDREN API called:', { groupField, groupValue, sortBy, filters, search, skip: skipNum, limit: validLimit });
    
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
    let processedData = applyGlobalSearch(allData, search, parsedSearchFields);
    
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
    
    // Add payload field to each item (mix of JSON, XML, and text)
    filteredData = filteredData.map((item, index) => {
      const payloadTypes = ['json', 'xml', 'text'];
      const payloadType = payloadTypes[index % payloadTypes.length];
      
      let payload;
      if (payloadType === 'json') {
        payload = JSON.stringify({
          itemId: item.id,
          metadata: {
            category: item.category,
            brand: item.brand,
            rating: item.rating,
            stock: item.stock,
            price: item.price,
            discountPercentage: item.discountPercentage,
            timestamp: new Date().toISOString(),
            tags: item.tags || [],
            images: item.images?.length || 0
          },
          analytics: {
            views: Math.floor(Math.random() * 10000),
            purchases: Math.floor(Math.random() * 1000),
            revenue: (item.price * Math.floor(Math.random() * 100)).toFixed(2)
          }
        }, null, 2);
      } else if (payloadType === 'xml') {
        payload = `<?xml version="1.0" encoding="UTF-8"?>
<item>
  <id>${item.id}</id>
  <title>${item.title}</title>
  <description>${item.description}</description>
  <category>${item.category}</category>
  <brand>${item.brand || 'N/A'}</brand>
  <price>${item.price}</price>
  <discountPercentage>${item.discountPercentage}</discountPercentage>
  <rating>${item.rating}</rating>
  <stock>${item.stock}</stock>
  <metadata>
    <sku>${item.sku || 'N/A'}</sku>
    <weight>${item.weight || 'N/A'}</weight>
    <dimensions>${JSON.stringify(item.dimensions || {})}</dimensions>
  </metadata>
  <timestamp>${new Date().toISOString()}</timestamp>
</item>`;
      } else {
        payload = `Item Details for ${item.title}
========================================
ID: ${item.id}
Title: ${item.title}
Description: ${item.description}
Category: ${item.category}
Brand: ${item.brand || 'N/A'}
Price: $${item.price}
Discount: ${item.discountPercentage}%
Rating: ${item.rating} / 5.0
Stock: ${item.stock} units
SKU: ${item.sku || 'N/A'}
Weight: ${item.weight || 'N/A'}
Tags: ${(item.tags || []).join(', ')}
Images: ${item.images?.length || 0} available
Last Updated: ${new Date().toISOString()}
========================================`;
      }
      
      return {
        ...item,
        payload: payload
      };
    });
    
    // Get total count before pagination
    const totalChildren = filteredData.length;
    
    // Apply pagination
    const paginatedData = filteredData.slice(skipNum, skipNum + validLimit);
    
    console.log('[SERVER] GROUP_CHILDREN response:', {
      totalItems: allData.length,
      totalChildren: totalChildren,
      returnedChildren: paginatedData.length,
      skip: skipNum,
      limit: validLimit,
      groupField,
      groupValue,
      sliceRange: `${skipNum} to ${skipNum + validLimit}`,
      actualReturned: paginatedData.length
    });
    
    // Return paginated children for this specific group
    res.json({
      content: paginatedData,
      total: totalChildren,
      skip: skipNum,
      limit: validLimit
    });
    
  } catch (error) {
    console.error('[SERVER] Error in /api/data/children:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint: GET /api/data/nested-groups
// Returns unique group values for a nested level, filtered by parent group values
// Supports multiple parent groups via parentFilters parameter (JSON array of {field, value})
app.get('/api/data/nested-groups', async (req, res) => {
  try {
    // Add 3 second delay for testing loading indicator
    await delay(3000);
    
    const { parentGroupField, parentGroupValue, parentFilters, childGroupField, sortBy, filters, search, searchFields } = req.query;
    
    // Support both old format (single parent) and new format (multiple parents)
    let parsedParentFilters = [];
    if (parentFilters) {
      try {
        parsedParentFilters = JSON.parse(parentFilters);
      } catch (e) {
        console.warn('[SERVER] Could not parse parentFilters:', e);
      }
    } else if (parentGroupField && parentGroupValue !== undefined) {
      // Legacy format: single parent
      parsedParentFilters = [{
        field: parentGroupField,
        value: parentGroupValue === '(null)' || parentGroupValue === '' ? null : parentGroupValue
      }];
    }
    
    if (!childGroupField || parsedParentFilters.length === 0) {
      return res.status(400).json({ error: 'childGroupField and at least one parent filter (via parentFilters or parentGroupField/parentGroupValue) are required' });
    }
    
    console.log('[SERVER] NESTED_GROUPS API called:', { 
      parentFilters: parsedParentFilters,
      childGroupField, 
      sortBy, 
      filters, 
      search 
    });
    
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
    let filteredData = applyGlobalSearch(allData, search, parsedSearchFields);
    
    // Add all parent group filters (supporting multiple parents)
    const parentGroupFilters = parsedParentFilters.map(pf => ({
      field: pf.field,
      operator: 'Equals',
      value: pf.value === '(null)' || pf.value === '' ? null : pf.value
    }));
    const allFilters = [...parsedFilters, ...parentGroupFilters];
    
    // Apply filters (includes parent group filter)
    filteredData = applyFilters(filteredData, allFilters);
    
    // Apply sorting
    filteredData = applySorting(filteredData, parsedSort);
    
    // Group data by child group field value (filtered by parent)
    const grouped = new Map();
    filteredData.forEach(item => {
      const value = getFieldValue(item, childGroupField);
      const key = value != null ? String(value) : '(null)';
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push(item);
    });
    
    // Build metadata array (only unique values and counts for child group)
    const metadata = [];
    grouped.forEach((items, key) => {
      metadata.push({
        value: key === '(null)' ? null : key,
        key: key,
        count: items.length
      });
    });
    
    // Sort metadata
    if (parsedSort && parsedSort.length > 0) {
      // Find sort config for child group field
      const childSort = parsedSort.find(s => s.field === childGroupField);
      if (childSort) {
        metadata.sort((a, b) => {
          if (childSort.direction === 'Desc') {
            return b.key.localeCompare(a.key);
          }
          return a.key.localeCompare(b.key);
        });
      } else {
        metadata.sort((a, b) => a.key.localeCompare(b.key));
      }
    } else {
      metadata.sort((a, b) => a.key.localeCompare(b.key));
    }
    
    console.log('[SERVER] NESTED_GROUPS response:', {
      parentFilters: parsedParentFilters,
      childGroupField,
      totalItems: allData.length,
      afterParentFilter: filteredData.length,
      uniqueChildGroups: metadata.length,
      sampleGroups: metadata.slice(0, 3).map(g => `${g.key}(${g.count})`).join(', ')
    });
    
    // Return unique child group values with counts
    res.json({
      groups: metadata,
      total: metadata.length,
      parentGroupField,
      parentGroupValue,
      childGroupField
    });
    
  } catch (error) {
    console.error('[SERVER] Error in /api/data/nested-groups:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to recursively get all field paths from an object
function getAllFieldPaths(obj, prefix = '') {
  const paths = [];
  if (obj && typeof obj === 'object' && !Array.isArray(obj) && !(obj instanceof Date)) {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const fullPath = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];
        
        // If it's a nested object (but not an array or date), recurse
        if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
          paths.push(...getAllFieldPaths(value, fullPath));
        } else {
          // Add the field path
          paths.push(fullPath);
        }
      }
    }
  }
  return paths;
}

// Helper function to apply global search
function applyGlobalSearch(data, searchTerm, searchFields = []) {
  if (!searchTerm || !searchTerm.trim()) {
    return data;
  }
  
  const searchLower = searchTerm.toLowerCase().trim();
  
  // If no specific fields provided, search in ALL fields of the first item
  let fieldsToSearch = searchFields;
  if (fieldsToSearch.length === 0 && data.length > 0) {
    // Get all field paths from the first item
    fieldsToSearch = getAllFieldPaths(data[0]);
    console.log('[SERVER] Global search - searching in all fields:', fieldsToSearch.slice(0, 10), '... (total:', fieldsToSearch.length, 'fields)');
  }
  
  return data.filter(item => {
    return fieldsToSearch.some(field => {
      const value = getFieldValue(item, field);
      if (value == null) return false;
      
      // Convert value to string and check if it contains the search term
      // Handle arrays by joining them
      let searchableValue = value;
      if (Array.isArray(value)) {
        searchableValue = value.join(' ');
      } else if (typeof value === 'object' && !(value instanceof Date)) {
        // Skip nested objects (they're already handled by getAllFieldPaths)
        return false;
      }
      
      return String(searchableValue).toLowerCase().includes(searchLower);
    });
  });
}

// Endpoint: GET /api/data
// Main endpoint for fetching data with pagination, filtering, sorting, and search
app.get('/api/data', async (req, res) => {
  try {
    // Add 3 second delay for testing loading indicator
    await delay(3000);
    
    const { skip, limit, sortBy, filters, search, searchFields } = req.query;
    
    // Parse pagination parameters
    const skipNum = parseInt(skip) || 0;
    const limitNum = parseInt(limit) || 10;
    const validLimit = limitNum > 0 ? limitNum : 10;
    
    console.log('[SERVER] DATA API called:', { 
      skip: skipNum, 
      limit: validLimit, 
      sortBy, 
      filters, 
      search,
      searchFields 
    });
    
    // Fetch all data from dummyjson.com (limit 100 for demo)
    const url = 'https://dummyjson.com/products?limit=100&skip=0';
    const response = await fetchFromDummyJson(url);
    const allData = response.products || [];
    
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
    let processedData = applyGlobalSearch(allData, search, parsedSearchFields);
    
    // Apply filters
    processedData = applyFilters(processedData, parsedFilters);
    
    // Get total count after filtering and searching (before sorting and pagination)
    const total = processedData.length;
    
    // Apply sorting
    processedData = applySorting(processedData, parsedSort);
    
    // Add payload field to each item (mix of JSON, XML, and text)
    processedData = processedData.map((item, index) => {
      const payloadTypes = ['json', 'xml', 'text'];
      const payloadType = payloadTypes[index % payloadTypes.length];
      
      let payload;
      if (payloadType === 'json') {
        payload = JSON.stringify({
          itemId: item.id,
          metadata: {
            category: item.category,
            brand: item.brand,
            rating: item.rating,
            stock: item.stock,
            price: item.price,
            discountPercentage: item.discountPercentage,
            timestamp: new Date().toISOString(),
            tags: item.tags || [],
            images: item.images?.length || 0
          },
          analytics: {
            views: Math.floor(Math.random() * 10000),
            purchases: Math.floor(Math.random() * 1000),
            revenue: (item.price * Math.floor(Math.random() * 100)).toFixed(2)
          }
        }, null, 2);
      } else if (payloadType === 'xml') {
        payload = `<?xml version="1.0" encoding="UTF-8"?>
<item>
  <id>${item.id}</id>
  <title>${item.title}</title>
  <description>${item.description}</description>
  <category>${item.category}</category>
  <brand>${item.brand || 'N/A'}</brand>
  <price>${item.price}</price>
  <discountPercentage>${item.discountPercentage}</discountPercentage>
  <rating>${item.rating}</rating>
  <stock>${item.stock}</stock>
  <metadata>
    <sku>${item.sku || 'N/A'}</sku>
    <weight>${item.weight || 'N/A'}</weight>
    <dimensions>${JSON.stringify(item.dimensions || {})}</dimensions>
  </metadata>
  <timestamp>${new Date().toISOString()}</timestamp>
</item>`;
      } else {
        payload = `Item Details for ${item.title}
========================================
ID: ${item.id}
Title: ${item.title}
Description: ${item.description}
Category: ${item.category}
Brand: ${item.brand || 'N/A'}
Price: $${item.price}
Discount: ${item.discountPercentage}%
Rating: ${item.rating} / 5.0
Stock: ${item.stock} units
SKU: ${item.sku || 'N/A'}
Weight: ${item.weight || 'N/A'}
Tags: ${(item.tags || []).join(', ')}
Images: ${item.images?.length || 0} available
Last Updated: ${new Date().toISOString()}
========================================`;
      }
      
      return {
        ...item,
        payload: payload
      };
    });
    
    // Apply pagination
    const paginatedData = processedData.slice(skipNum, skipNum + validLimit);
    
    // Debug: Check if payload is present in first item
    if (paginatedData.length > 0) {
      console.log('[SERVER] First product has payload:', !!paginatedData[0].payload);
      if (paginatedData[0].payload) {
        console.log('[SERVER] Payload type:', typeof paginatedData[0].payload);
        console.log('[SERVER] Payload preview:', paginatedData[0].payload.substring(0, 100));
      }
    }
    
    console.log('[SERVER] DATA API response:', {
      totalItems: allData.length,
      afterSearchAndFilters: total,
      returnedItems: paginatedData.length,
      skip: skipNum,
      limit: validLimit,
      hasPayload: paginatedData.length > 0 && !!paginatedData[0].payload
    });
    
    // Return paginated data with total count
    res.json({
      content: paginatedData,
      total: total,
      skip: skipNum,
      limit: validLimit,
      hasMore: (skipNum + validLimit) < total
    });
    
  } catch (error) {
    console.error('[SERVER] Error in /api/data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to convert data to CSV
function convertToCSV(data, columns) {
  if (!data || data.length === 0) {
    return '';
  }
  
  // Get headers from columns or use all keys from first item
  const headers = columns && columns.length > 0 
    ? columns.map(col => col.title || col.field)
    : Object.keys(data[0]);
  
  // Build CSV rows
  const rows = [headers.join(',')];
  
  data.forEach(item => {
    const values = columns && columns.length > 0
      ? columns.map(col => {
          const value = getFieldValue(item, col.field);
          // Escape commas and quotes in CSV
          const str = value != null ? String(value) : '';
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
      : Object.values(item).map(v => {
          const str = v != null ? String(v) : '';
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        });
    rows.push(values.join(','));
  });
  
  return rows.join('\n');
}

// Helper function to convert data to Excel (CSV format with proper headers)
function convertToExcel(data, columns) {
  // For now, return CSV format (can be enhanced with xlsx library)
  return convertToCSV(data, columns);
}

// Helper function to convert data to PDF (HTML table)
function convertToPDF(data, columns) {
  const headers = columns && columns.length > 0 
    ? columns.map(col => col.title || col.field)
    : Object.keys(data[0] || {});
  
  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; font-weight: bold; }
    tr:nth-child(even) { background-color: #f9f9f9; }
  </style>
</head>
<body>
  <h1>Product Export</h1>
  <table>
    <thead>
      <tr>
        ${headers.map(h => `<th>${h}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${data.map(item => {
        const values = columns && columns.length > 0
          ? columns.map(col => {
              const value = getFieldValue(item, col.field);
              return value != null ? String(value) : '';
            })
          : Object.values(item).map(v => v != null ? String(v) : '');
        return `<tr>${values.map(v => `<td>${v.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`).join('')}</tr>`;
      }).join('')}
    </tbody>
  </table>
</body>
</html>`;
  
  return html;
}

// Endpoint: POST /api/data/export
// Exports ALL data (not paginated) in the requested format with current filters/sort
app.post('/api/data/export', async (req, res) => {
  try {
    const { format, sort, filters, groups, columns, search } = req.body;
    
    if (!format || !['csv', 'excel', 'pdf'].includes(format)) {
      return res.status(400).json({ error: 'format must be csv, excel, or pdf' });
    }
    
    console.log('[SERVER] EXPORT API called:', { format, sort, filters, groups, columns: columns?.length, search });
    
    // Fetch ALL data from dummyjson.com (limit 100 for demo, but no pagination)
    const url = 'https://dummyjson.com/products?limit=100&skip=0';
    const response = await fetchFromDummyJson(url);
    const allData = response.products || [];
    
    // Parse filters if provided
    let parsedFilters = filters || [];
    
    // Parse sort if provided
    let parsedSort = sort || [];
    
    // Apply global search first (before filters)
    let processedData = applyGlobalSearch(allProducts, search, []);
    
    // Apply filters
    processedData = applyFilters(processedData, parsedFilters);
    
    // Note: Groups are typically handled client-side for display, but for export
    // we export all matching data (not grouped). If you want grouped export,
    // you would need to handle groups here.
    
    // Apply sorting
    processedData = applySorting(processedData, parsedSort);
    
    // Add payload field to each item (mix of JSON, XML, and text)
    processedData = processedData.map((item, index) => {
      const payloadTypes = ['json', 'xml', 'text'];
      const payloadType = payloadTypes[index % payloadTypes.length];
      
      let payload;
      if (payloadType === 'json') {
        payload = JSON.stringify({
          itemId: item.id,
          metadata: {
            category: item.category,
            brand: item.brand,
            rating: item.rating,
            stock: item.stock,
            price: item.price,
            discountPercentage: item.discountPercentage,
            timestamp: new Date().toISOString(),
            tags: item.tags || [],
            images: item.images?.length || 0
          },
          analytics: {
            views: Math.floor(Math.random() * 10000),
            purchases: Math.floor(Math.random() * 1000),
            revenue: (item.price * Math.floor(Math.random() * 100)).toFixed(2)
          }
        }, null, 2);
      } else if (payloadType === 'xml') {
        payload = `<?xml version="1.0" encoding="UTF-8"?>
<item>
  <id>${item.id}</id>
  <title>${item.title}</title>
  <description>${item.description}</description>
  <category>${item.category}</category>
  <brand>${item.brand || 'N/A'}</brand>
  <price>${item.price}</price>
  <discountPercentage>${item.discountPercentage}</discountPercentage>
  <rating>${item.rating}</rating>
  <stock>${item.stock}</stock>
  <metadata>
    <sku>${item.sku || 'N/A'}</sku>
    <weight>${item.weight || 'N/A'}</weight>
    <dimensions>${JSON.stringify(item.dimensions || {})}</dimensions>
  </metadata>
  <timestamp>${new Date().toISOString()}</timestamp>
</item>`;
      } else {
        payload = `Item Details for ${item.title}
========================================
ID: ${item.id}
Title: ${item.title}
Description: ${item.description}
Category: ${item.category}
Brand: ${item.brand || 'N/A'}
Price: $${item.price}
Discount: ${item.discountPercentage}%
Rating: ${item.rating} / 5.0
Stock: ${item.stock} units
SKU: ${item.sku || 'N/A'}
Weight: ${item.weight || 'N/A'}
Tags: ${(item.tags || []).join(', ')}
Images: ${item.images?.length || 0} available
Last Updated: ${new Date().toISOString()}
========================================`;
      }
      
      return {
        ...item,
        payload: payload
      };
    });
    
    console.log('[SERVER] EXPORT response:', {
      totalItems: allData.length,
      afterSearchAndFilters: processedData.length,
      format
    });
    
    // Convert to requested format
    let content;
    let contentType;
    let filename;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    
    switch (format) {
      case 'csv':
        content = convertToCSV(processedData, columns);
        contentType = 'text/csv';
        filename = `export-${timestamp}.csv`;
        break;
      case 'excel':
        content = convertToExcel(processedData, columns);
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        filename = `export-${timestamp}.xlsx`;
        // For Excel, we'll send CSV with .xlsx extension (can be enhanced with xlsx library)
        break;
      case 'pdf':
        content = convertToPDF(processedData, columns);
        contentType = 'application/pdf';
        filename = `export-${timestamp}.pdf`;
        // For PDF, we'll send HTML (can be enhanced with pdf library like puppeteer or pdfkit)
        break;
    }
    
    // Set headers for file download
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Send content
    res.send(content);
    
  } catch (error) {
    console.error('[SERVER] Error in /api/data/export:', error);
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
  console.log(`[SERVER] Data endpoint: http://localhost:${PORT}/api/data`);
  console.log(`[SERVER] Group metadata endpoint: http://localhost:${PORT}/api/data/groups`);
  console.log(`[SERVER] Group children endpoint: http://localhost:${PORT}/api/data/children`);
  console.log(`[SERVER] Export endpoint: http://localhost:${PORT}/api/data/export`);
});
