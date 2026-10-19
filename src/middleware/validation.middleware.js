// Limits that mirror the column sizes in schema.sql, so oversized input is
// rejected with a 400 instead of failing inside PostgreSQL.
const MAX_INTEGER_ID = 2147483647; // PostgreSQL INTEGER upper bound
const MAX_NAME_LENGTH = 255;
const MAX_EMAIL_LENGTH = 255;
const MAX_TITLE_LENGTH = 255;
const MAX_CONDITION_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_PRICE = 99999999.99; // NUMERIC(10, 2)
const MAX_MESSAGE_LENGTH = 2000;
const MAX_SEARCH_LENGTH = 200;
const MIN_PASSWORD_LENGTH = 6;
// bcrypt only uses the first 72 BYTES of a password and silently ignores the rest.
// Non-ASCII characters take 2-4 bytes in UTF-8, so the limit is checked in bytes.
const MAX_PASSWORD_BYTES = 72;

// Returns an error message for a new password, or null when it is acceptable.
// Only applied when a password is being set (register, change password). Login and
// current-password checks are not limited, so accounts created before this limit
// existed can still sign in.
const getNewPasswordError = (password, fieldName) => {
  if (typeof password !== 'string') {
    return `${fieldName} is required and must be a string.`;
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `${fieldName} must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
  }
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    return `${fieldName} must not exceed ${MAX_PASSWORD_BYTES} bytes (non-ASCII characters count as more than one byte).`;
  }
  return null;
};

// Accepts a positive whole number that fits in an INTEGER column, given either as a
// JSON number or as a plain digit string from the URL ("12", but not "1.0", "1e2" or " 12").
const isValidId = (value) => {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 && value <= MAX_INTEGER_ID;
  }
  if (typeof value === 'string') {
    return /^[1-9]\d{0,9}$/.test(value) && Number(value) <= MAX_INTEGER_ID;
  }
  return false;
};

const isValidPrice = (price) => {
  return typeof price === 'number' && Number.isFinite(price) && price > 0 && price <= MAX_PRICE;
};

export const validateRegister = (req, res, next) => {
  const { name, email, password } = req.body;
  const errors = [];

  if (!name || typeof name !== 'string' || name.trim() === '') {
    errors.push('Name is required and cannot be empty.');
  } else if (name.length > MAX_NAME_LENGTH) {
    errors.push(`Name must not exceed ${MAX_NAME_LENGTH} characters.`);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || typeof email !== 'string' || !emailRegex.test(email)) {
    errors.push('A valid email is required.');
  } else if (email.length > MAX_EMAIL_LENGTH) {
    errors.push(`Email must not exceed ${MAX_EMAIL_LENGTH} characters.`);
  }

  const passwordError = getNewPasswordError(password, 'Password');
  if (passwordError) {
    errors.push(passwordError);
  }

  if (errors.length > 0) {
    return res.status(400).json({ message: "Validation failed", errors });
  }

  next();
};

export const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  const errors = [];

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || typeof email !== 'string' || !emailRegex.test(email)) {
    errors.push('A valid email is required.');
  }

  if (!password || typeof password !== 'string') {
    errors.push('Password is required.');
  }

  if (errors.length > 0) {
    return res.status(400).json({ message: "Validation failed", errors });
  }

  next();
};

export const validateCreateListing = (req, res, next) => {
  const { title, description, price, condition, category_id } = req.body;
  const errors = [];

  if (!title || typeof title !== 'string' || title.trim() === '') {
    errors.push('Title is required and must be a non-empty string.');
  } else if (title.length > MAX_TITLE_LENGTH) {
    errors.push(`Title must not exceed ${MAX_TITLE_LENGTH} characters.`);
  }

  if (!description || typeof description !== 'string' || description.trim() === '') {
    errors.push('Description is required and must be a non-empty string.');
  } else if (description.length > MAX_DESCRIPTION_LENGTH) {
    errors.push(`Description must not exceed ${MAX_DESCRIPTION_LENGTH} characters.`);
  }

  if (!isValidPrice(price)) {
    errors.push(`Price is required and must be a number greater than 0 and at most ${MAX_PRICE}.`);
  }

  if (!condition || typeof condition !== 'string' || condition.trim() === '') {
    errors.push('Condition is required and must be a non-empty string.');
  } else if (condition.length > MAX_CONDITION_LENGTH) {
    errors.push(`Condition must not exceed ${MAX_CONDITION_LENGTH} characters.`);
  }

  if (typeof category_id !== 'number' || !isValidId(category_id)) {
    errors.push('Category ID is required and must be a valid positive integer.');
  }

  if (errors.length > 0) {
    return res.status(400).json({ message: "Validation failed", errors });
  }

  next();
};

export const validateUpdateListing = (req, res, next) => {
  const { title, description, price, condition, category_id, seller_id } = req.body;
  const errors = [];
  let hasValidField = false;

  if (seller_id !== undefined) {
    errors.push('seller_id cannot be modified.');
  }

  if (title !== undefined) {
    if (typeof title !== 'string' || title.trim() === '') {
      errors.push('Title must be a non-empty string.');
    } else if (title.length > MAX_TITLE_LENGTH) {
      errors.push(`Title must not exceed ${MAX_TITLE_LENGTH} characters.`);
    } else {
      hasValidField = true;
    }
  }

  if (description !== undefined) {
    if (typeof description !== 'string' || description.trim() === '') {
      errors.push('Description must be a non-empty string.');
    } else if (description.length > MAX_DESCRIPTION_LENGTH) {
      errors.push(`Description must not exceed ${MAX_DESCRIPTION_LENGTH} characters.`);
    } else {
      hasValidField = true;
    }
  }

  if (price !== undefined) {
    if (!isValidPrice(price)) {
      errors.push(`Price must be a number greater than 0 and at most ${MAX_PRICE}.`);
    } else {
      hasValidField = true;
    }
  }

  if (condition !== undefined) {
    if (typeof condition !== 'string' || condition.trim() === '') {
      errors.push('Condition must be a non-empty string.');
    } else if (condition.length > MAX_CONDITION_LENGTH) {
      errors.push(`Condition must not exceed ${MAX_CONDITION_LENGTH} characters.`);
    } else {
      hasValidField = true;
    }
  }

  if (category_id !== undefined) {
    if (typeof category_id !== 'number' || !isValidId(category_id)) {
      errors.push('Category ID must be a valid positive integer.');
    } else {
      hasValidField = true;
    }
  }

  if (errors.length === 0 && !hasValidField) {
    errors.push('At least one valid updatable field must be provided.');
  }

  if (errors.length > 0) {
    return res.status(400).json({ message: "Validation failed", errors });
  }

  next();
};

export const validateCreateCategory = (req, res, next) => {
  const { name } = req.body;
  const errors = [];

  if (!name || typeof name !== 'string' || name.trim() === '') {
    errors.push('Name is required and must be a non-empty string.');
  } else if (name.length > MAX_NAME_LENGTH) {
    errors.push(`Name must not exceed ${MAX_NAME_LENGTH} characters.`);
  }

  if (errors.length > 0) {
    return res.status(400).json({ message: "Validation failed", errors });
  }

  next();
};

export const validateCategoryId = (req, res, next) => {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({
      message: "Validation failed",
      errors: ['Category ID must be a valid positive integer.']
    });
  }
  next();
};

export const validateGetListingsQuery = (req, res, next) => {
  const { category, page, limit, search, sortBy, order } = req.query;
  const errors = [];

  // A repeated key (e.g. ?order=asc&order=desc) arrives as an array; reject it
  // up front so the checks below only ever see strings.
  for (const [key, value] of Object.entries({ category, page, limit, search, sortBy, order })) {
    if (value !== undefined && typeof value !== 'string') {
      errors.push(`${key} query parameter must be provided only once.`);
    }
  }
  if (errors.length > 0) {
    return res.status(400).json({ message: "Validation failed", errors });
  }

  if (category !== undefined && !isValidId(category)) {
    errors.push('Category query parameter must be a positive integer.');
  }

  if (page !== undefined && !isValidId(page)) {
    errors.push('Page must be a positive integer.');
  }

  if (limit !== undefined) {
    if (!isValidId(limit) || Number(limit) > 100) {
      errors.push('Limit must be a positive integer not exceeding 100.');
    }
  }

  if (search !== undefined) {
    if (search.trim() === '') {
      errors.push('Search query parameter must be a non-empty string.');
    } else if (search.length > MAX_SEARCH_LENGTH) {
      errors.push(`Search query parameter must not exceed ${MAX_SEARCH_LENGTH} characters.`);
    }
  }

  if (sortBy !== undefined) {
    const allowedSortBy = ['price', 'created_at', 'title'];
    if (!allowedSortBy.includes(sortBy)) {
      errors.push('sortBy must be one of: price, created_at, title.');
    }
  }

  if (order !== undefined) {
    const allowedOrder = ['asc', 'desc'];
    if (!allowedOrder.includes(order.toLowerCase())) {
      errors.push('order must be one of: asc, desc.');
    }
  }
  
  if (errors.length > 0) {
    return res.status(400).json({ message: "Validation failed", errors });
  }
  
  next();
};

export const validateUpdateProfile = (req, res, next) => {
  const { name, email, ...otherFields } = req.body;
  const errors = [];
  let hasValidField = false;

  if (Object.keys(otherFields).length > 0) {
    errors.push('Unsupported fields provided. Only name and email can be updated.');
  }

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim() === '') {
      errors.push('Name must be a non-empty string.');
    } else if (name.length > MAX_NAME_LENGTH) {
      errors.push(`Name must not exceed ${MAX_NAME_LENGTH} characters.`);
    } else {
      hasValidField = true;
    }
  }

  if (email !== undefined) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (typeof email !== 'string' || !emailRegex.test(email)) {
      errors.push('A valid email is required.');
    } else if (email.length > MAX_EMAIL_LENGTH) {
      errors.push(`Email must not exceed ${MAX_EMAIL_LENGTH} characters.`);
    } else {
      hasValidField = true;
    }
  }

  if (errors.length === 0 && !hasValidField) {
    errors.push('At least one valid updatable field must be provided.');
  }

  if (errors.length > 0) {
    return res.status(400).json({ message: "Validation failed", errors });
  }

  next();
};

export const validateChangePassword = (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  const errors = [];

  if (typeof currentPassword !== 'string' || currentPassword.trim() === '') {
    errors.push('currentPassword is required and must be a string.');
  }

  const newPasswordError = getNewPasswordError(newPassword, 'newPassword');
  if (newPasswordError) {
    errors.push(newPasswordError);
  }

  if (typeof currentPassword === 'string' && typeof newPassword === 'string' && currentPassword === newPassword) {
    errors.push('newPassword must be different from currentPassword.');
  }

  if (errors.length > 0) {
    return res.status(400).json({ message: "Validation failed", errors });
  }

  next();
};

export const validateDeleteAccount = (req, res, next) => {
  const { currentPassword } = req.body;
  const errors = [];

  if (typeof currentPassword !== 'string' || currentPassword.trim() === '') {
    errors.push('currentPassword is required and must be a non-empty string.');
  }

  if (errors.length > 0) {
    return res.status(400).json({ message: "Validation failed", errors });
  }

  next();
};

// For routes shaped like /listings/:id
export const validateListingId = (req, res, next) => {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({
      message: "Validation failed",
      errors: ['Listing ID must be a valid positive integer.']
    });
  }
  next();
};

// For routes shaped like /listings/:listingId/... and /favorites/:listingId
export const validateListingIdParam = (req, res, next) => {
  if (!isValidId(req.params.listingId)) {
    return res.status(400).json({
      message: "Validation failed",
      errors: ['Listing ID must be a valid positive integer.']
    });
  }
  next();
};

export const validateCreateMessage = (req, res, next) => {
  const { listing_id, content, ...otherFields } = req.body;
  const errors = [];

  if (Object.keys(otherFields).length > 0) {
    errors.push('Unsupported fields provided. Only listing_id and content are allowed.');
  }

  if (typeof listing_id !== 'number' || !isValidId(listing_id)) {
    errors.push('listing_id is required and must be a valid positive integer.');
  }

  if (content === undefined || typeof content !== 'string' || content.trim() === '') {
    errors.push('content is required and must be a non-empty string.');
  } else if (content.length > MAX_MESSAGE_LENGTH) {
    errors.push(`content must not exceed ${MAX_MESSAGE_LENGTH} characters.`);
  }

  if (errors.length > 0) {
    return res.status(400).json({ message: "Validation failed", errors });
  }

  next();
};

export const validateOtherUserIdParam = (req, res, next) => {
  if (!isValidId(req.params.otherUserId)) {
    return res.status(400).json({
      message: "Validation failed",
      errors: ['otherUserId must be a valid positive integer.']
    });
  }
  next();
};

export const validateImageIdParam = (req, res, next) => {
  if (!isValidId(req.params.imageId)) {
    return res.status(400).json({
      message: "Validation failed",
      errors: ['imageId must be a valid positive integer.']
    });
  }
  next();
};

export const validateAIChat = (req, res, next) => {
  const { message, context, history, ...unsupported } = req.body;
  const errors = [];

  if (Object.keys(unsupported).length > 0) {
    errors.push('Unsupported fields provided.');
  }

  if (typeof message !== 'string' || message.trim() === '') {
    errors.push('Message is required and must be a non-empty string.');
  } else if (message.length > 2000) {
    errors.push('Message must not exceed 2000 characters.');
  }

  if (history !== undefined) {
    if (!Array.isArray(history)) {
      errors.push('History must be an array.');
    } else if (history.length > 10) {
      errors.push('History cannot exceed 10 messages.');
    } else {
      let totalHistorySize = 0;
      for (let i = 0; i < history.length; i++) {
        const item = history[i];
        if (typeof item !== 'object' || item === null) {
          errors.push(`History item at index ${i} must be an object.`);
          continue;
        }
        
        const { role, content, listings, ...unsupportedHistoryFields } = item;
        
        if (Object.keys(unsupportedHistoryFields).length > 0) {
          errors.push(`History item at index ${i} contains unsupported fields.`);
        }
        
        if (role !== 'user' && role !== 'assistant') {
          errors.push(`History item at index ${i} must have role 'user' or 'assistant'.`);
        }
        
        if (typeof content !== 'string') {
          errors.push(`History item at index ${i} must have a string content.`);
        } else if (content.length > 2000) {
          errors.push(`History item at index ${i} content exceeds 2000 characters.`);
        } else {
          totalHistorySize += content.length;
        }

        if (listings !== undefined) {
          if (!Array.isArray(listings)) {
            errors.push(`History item at index ${i} listings must be an array.`);
          } else if (listings.length > 20) {
            errors.push(`History item at index ${i} listings cannot exceed 20 items.`);
          }
        }
      }
      
      if (totalHistorySize > 15000) {
        errors.push('Total history size exceeds maximum allowed limit.');
      }
    }
  }

  if (context !== undefined) {
    if (typeof context !== 'object' || context === null || Array.isArray(context)) {
      errors.push('Context must be an object.');
    } else {
      const { listingId, ...unsupportedContext } = context;
      
      if (Object.keys(unsupportedContext).length > 0) {
        errors.push('Unsupported fields provided in context.');
      }
      
      if (listingId !== undefined) {
        if (typeof listingId !== 'number' || !isValidId(listingId)) {
          errors.push('context.listingId must be a positive integer.');
        }
      }
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      message: "Validation failed",
      errors: errors
    });
  }

  next();
};
