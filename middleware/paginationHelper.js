// Pagination helper for Firestore queries
export class PaginationHelper {
  
  // Default pagination settings
  static DEFAULT_PAGE_SIZE = 20;
  static MAX_PAGE_SIZE = 100;
  
  // Parse pagination parameters from request
  static parsePaginationParams(req) {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(
      this.MAX_PAGE_SIZE, 
      Math.max(1, parseInt(req.query.limit) || this.DEFAULT_PAGE_SIZE)
    );
    const offset = (page - 1) * limit;
    
    // Cursor-based pagination support
    const cursor = req.query.cursor || null;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';
    
    return {
      page,
      limit,
      offset,
      cursor,
      sortBy,
      sortOrder
    };
  }
  
  // Build paginated Firestore query
  static buildPaginatedQuery(collection, pagination, filters = {}) {
    let query = collection;
    
    // Apply filters
    Object.entries(filters).forEach(([field, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          query = query.where(field, 'in', value);
        } else if (typeof value === 'object' && value.operator) {
          query = query.where(field, value.operator, value.value);
        } else {
          query = query.where(field, '==', value);
        }
      }
    });
    
    // Apply sorting
    query = query.orderBy(pagination.sortBy, pagination.sortOrder);
    
    // Apply cursor-based pagination if cursor provided
    if (pagination.cursor) {
      try {
        const cursorDoc = JSON.parse(Buffer.from(pagination.cursor, 'base64').toString());
        query = query.startAfter(cursorDoc[pagination.sortBy]);
      } catch (error) {
        console.warn('Invalid cursor provided, ignoring:', error.message);
      }
    } else if (pagination.offset > 0) {
      // Fallback to offset-based pagination (less efficient)
      query = query.offset(pagination.offset);
    }
    
    // Apply limit
    query = query.limit(pagination.limit);
    
    return query;
  }
  
  // Execute paginated query and format response
  static async executePaginatedQuery(query, pagination) {
    try {
      const snapshot = await query.get();
      const docs = snapshot.docs;
      
      // Convert documents to data
      const items = docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Convert Firestore timestamps to dates
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      }));
      
      // Generate next cursor if there are more results
      let nextCursor = null;
      if (docs.length === pagination.limit) {
        const lastDoc = docs[docs.length - 1];
        const cursorData = { [pagination.sortBy]: lastDoc.data()[pagination.sortBy] };
        nextCursor = Buffer.from(JSON.stringify(cursorData)).toString('base64');
      }
      
      // Calculate pagination metadata
      const hasNextPage = docs.length === pagination.limit;
      const hasPrevPage = pagination.page > 1 || !!pagination.cursor;
      
      return {
        items,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          totalItems: items.length, // Note: Firestore doesn't provide total count efficiently
          hasNextPage,
          hasPrevPage,
          nextCursor,
          sortBy: pagination.sortBy,
          sortOrder: pagination.sortOrder
        }
      };
    } catch (error) {
      console.error('Paginated query execution error:', error);
      throw new Error('Failed to execute paginated query');
    }
  }
  
  // Get total count (expensive operation - use sparingly)
  static async getTotalCount(collection, filters = {}) {
    try {
      let query = collection;
      
      // Apply same filters as main query
      Object.entries(filters).forEach(([field, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            query = query.where(field, 'in', value);
          } else if (typeof value === 'object' && value.operator) {
            query = query.where(field, value.operator, value.value);
          } else {
            query = query.where(field, '==', value);
          }
        }
      });
      
      const snapshot = await query.count().get();
      return snapshot.data().count;
    } catch (error) {
      console.warn('Count query failed:', error.message);
      return null; // Return null if count is not available
    }
  }
  
  // Format pagination response
  static formatPaginationResponse(data, pagination, totalCount = null) {
    const response = {
      success: true,
      data: data.items,
      pagination: {
        currentPage: pagination.page,
        pageSize: pagination.limit,
        totalItems: totalCount,
        hasNextPage: data.pagination.hasNextPage,
        hasPrevPage: data.pagination.hasPrevPage,
        nextCursor: data.pagination.nextCursor,
        sortBy: pagination.sortBy,
        sortOrder: pagination.sortOrder
      }
    };
    
    // Add total pages if total count is available
    if (totalCount !== null) {
      response.pagination.totalPages = Math.ceil(totalCount / pagination.limit);
    }
    
    return response;
  }
  
  // Create pagination links for API responses
  static createPaginationLinks(req, pagination) {
    const baseUrl = `${req.protocol}://${req.get('host')}${req.path}`;
    const queryParams = new URLSearchParams(req.query);
    
    const links = {};
    
    // Self link
    links.self = `${baseUrl}?${queryParams.toString()}`;
    
    // Next page link
    if (pagination.hasNextPage) {
      const nextParams = new URLSearchParams(queryParams);
      if (pagination.nextCursor) {
        nextParams.set('cursor', pagination.nextCursor);
        nextParams.delete('page'); // Use cursor instead of page
      } else {
        nextParams.set('page', pagination.page + 1);
      }
      links.next = `${baseUrl}?${nextParams.toString()}`;
    }
    
    // Previous page link
    if (pagination.hasPrevPage && !pagination.nextCursor) {
      const prevParams = new URLSearchParams(queryParams);
      prevParams.set('page', Math.max(1, pagination.page - 1));
      links.prev = `${baseUrl}?${prevParams.toString()}`;
    }
    
    // First page link
    if (pagination.page > 1) {
      const firstParams = new URLSearchParams(queryParams);
      firstParams.set('page', 1);
      firstParams.delete('cursor');
      links.first = `${baseUrl}?${firstParams.toString()}`;
    }
    
    return links;
  }
}

// Middleware to add pagination to request
export const paginationMiddleware = (req, res, next) => {
  req.pagination = PaginationHelper.parsePaginationParams(req);
  next();
};

// Express route helper for paginated responses
export const sendPaginatedResponse = (res, data, req, totalCount = null) => {
  const response = PaginationHelper.formatPaginationResponse(data, req.pagination, totalCount);
  
  // Add pagination links
  response.links = PaginationHelper.createPaginationLinks(req, data.pagination);
  
  res.json(response);
};

export default PaginationHelper;