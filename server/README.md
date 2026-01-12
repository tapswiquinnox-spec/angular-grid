# Server API for Angular Data Grid

This Node.js server provides optimized API endpoints for server-side grouping in the Angular Data Grid.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm run server
```

The server will start on `http://localhost:3000`

## API Endpoints

### 1. GET /api/products
**Purpose:** Main endpoint for fetching products with pagination, filtering, sorting, and global search

**Query Parameters:**
- `skip` (optional): Number of products to skip (for pagination, default: 0)
- `limit` (optional): Maximum number of products to return (for pagination, default: 10)
- `sortBy` (optional): JSON stringified array of sort configurations
  - Example: `[{"field":"price","direction":"Asc"},{"field":"title","direction":"Desc"}]`
- `filters` (optional): JSON stringified array of filter conditions
  - Example: `[{"field":"category","operator":"Equals","value":"electronics"}]`
- `search` (optional): Global search term (searches across multiple fields)
- `searchFields` (optional): JSON stringified array of field names to search in (defaults to common text fields)

**Supported Filter Operators:**
- `Equals`: Exact match
- `Contains`: Partial text match (case-insensitive)
- `GreaterThan`: Numeric comparison
- `LessThan`: Numeric comparison
- `GreaterThanOrEqual`: Numeric comparison
- `LessThanOrEqual`: Numeric comparison

**Response:**
```json
{
  "products": [
    {
      "id": 1,
      "title": "iPhone 9",
      "category": "electronics",
      "price": 549,
      ...
    }
  ],
  "total": 100,
  "skip": 0,
  "limit": 10,
  "hasMore": true
}
```

**Example:**
```
GET http://localhost:3000/api/products?skip=0&limit=10&sortBy=[{"field":"price","direction":"Asc"}]&filters=[{"field":"category","operator":"Equals","value":"electronics"}]&search=iphone
```

**Features:**
- **Pagination**: Use `skip` and `limit` to paginate through results
- **Filtering**: Apply multiple filters with different operators
- **Sorting**: Sort by multiple fields with ascending/descending order
- **Global Search**: Search across multiple fields simultaneously
- **Combined Operations**: All operations can be combined (e.g., search + filter + sort + pagination)

### 2. GET /api/products/groups
**Purpose:** Fetch unique group values and their counts (First API call for grouping) with pagination

**Query Parameters:**
- `groupField` (required): The field to group by (e.g., "category")
- `skip` (optional): Number of groups to skip (for pagination, default: 0)
- `limit` (optional): Maximum number of groups to return (for pagination, default: 10)
- `sortBy` (optional): JSON stringified array of sort configurations
- `filters` (optional): JSON stringified array of filter conditions

**Response:**
```json
{
  "groups": [
    {
      "value": "electronics",
      "key": "electronics",
      "count": 10
    },
    {
      "value": "furniture",
      "key": "furniture",
      "count": 5
    }
  ],
  "total": 15,
  "skip": 0,
  "limit": 10
}
```

**Example:**
```
GET http://localhost:3000/api/products/groups?groupField=category&skip=0&limit=10&sortBy=[{"field":"category","direction":"Asc"}]&filters=[]
```

**Pagination:**
- `total`: Total number of unique groups (across all pages)
- `skip`: Number of groups skipped (for current page)
- `limit`: Maximum groups returned in this response
- The response contains only the groups for the current page

### 3. GET /api/products/children
**Purpose:** Fetch children for a specific group value (Second API call for grouping)

**Query Parameters:**
- `groupField` (required): The field to group by
- `groupValue` (required): The specific group value to fetch children for
- `sortBy` (optional): JSON stringified array of sort configurations
- `filters` (optional): JSON stringified array of filter conditions (excluding the group filter)

**Response:**
```json
{
  "products": [
    {
      "id": 1,
      "title": "iPhone 9",
      "category": "electronics",
      ...
    }
  ],
  "total": 10
}
```

**Example:**
```
GET http://localhost:3000/api/products/children?groupField=category&groupValue=electronics&sortBy=[]&filters=[]
```

### 4. GET /health
**Purpose:** Health check endpoint

**Response:**
```json
{
  "status": "ok",
  "message": "Server is running"
}
```

## How It Works

1. **Products API**: The main endpoint `/api/products` handles all standard data operations:
   - Fetches data from `https://dummyjson.com/products`
   - Applies global search (searches across multiple fields)
   - Applies filters (multiple filters with different operators)
   - Applies sorting (multiple sort fields)
   - Applies pagination (returns only requested page)
   - Returns optimized response with only the data needed

2. **Group Metadata API**: When grouping is enabled, the Angular component calls `/api/products/groups` to get only the unique group values and their counts. This avoids fetching all product data.

3. **Group Children API**: When a group is expanded, the Angular component calls `/api/products/children` with the specific group value to fetch only the children for that group.

4. **Data Processing**: The server fetches data from `https://dummyjson.com/products`, applies all operations server-side, and returns only the required data.

## Benefits

- **Reduced Data Transfer**: Only sends the data that's actually needed
- **Better Performance**: Server-side filtering and grouping reduces client-side processing
- **Clear API Separation**: Two distinct endpoints for two distinct purposes
- **Network Tab Visibility**: Easy to see which API is being called in browser DevTools
