import { AppError } from '../utils/AppError.js';

// Friendly messages for unique-constraint violations, keyed by constraint name.
// These cover races where two requests pass an application-level check at once.
const uniqueViolationMessages = {
  users_email_key: 'Email already registered',
  categories_name_key: 'Category already exists',
};

// Friendly messages for foreign-key violations, keyed by constraint name
const foreignKeyMessages = {
  listings_category_id_fkey: 'Category does not exist',
  listings_seller_id_fkey: 'User account no longer exists',
};

// Maps PostgreSQL error codes that are caused by bad client input to 4xx responses.
// Anything not listed here is treated as a genuine server error.
const mapDatabaseError = (err) => {
  switch (err.code) {
    case '23505': // unique_violation
      return { status: 409, message: uniqueViolationMessages[err.constraint] || 'A conflict occurred: record already exists' };
    case '23503': // foreign_key_violation
      return { status: 400, message: foreignKeyMessages[err.constraint] || 'Referenced record does not exist' };
    case '23514': // check_violation
      return { status: 400, message: 'Value violates a data constraint' };
    case '22P02': // invalid_text_representation (e.g. "abc" for an integer)
      return { status: 400, message: 'Invalid input format' };
    case '22001': // string_data_right_truncation
      return { status: 400, message: 'Value is too long' };
    case '22003': // numeric_value_out_of_range
      return { status: 400, message: 'Numeric value is out of range' };
    default:
      return null;
  }
};

export const notFoundHandler = (req, res, next) => {
  next(new AppError(`Route ${req.method} ${req.path} not found`, 404));
};

// Every error response uses the same shape: { message } here, and
// { message: "Validation failed", errors: [...] } from validation.middleware.js
// Express recognises error handlers by their four parameters, so _next must stay even though it is unused
export const errorHandler = (err, req, res, _next) => {
  let status;
  let message;

  if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON in request body';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Request body is too large';
  } else if (mapDatabaseError(err)) {
    ({ status, message } = mapDatabaseError(err));
  } else if (err instanceof AppError || err.statusCode) {
    status = err.statusCode || 500;
    message = err.message;
  } else {
    status = 500;
  }

  // Never leak internal stack traces or SQL strings. AppErrors are raised on
  // purpose with a client-facing message (e.g. 503 "AI service temporarily
  // unavailable"), so only unexpected server errors are masked and logged.
  if (status >= 500 && !(err instanceof AppError)) {
    // Only unexpected failures are logged. Client errors are not, because
    // body-parser errors carry the raw request body (which may include passwords).
    console.error(err);
    message = 'Internal server error';
  }

  res.status(status).json({ message });
};
