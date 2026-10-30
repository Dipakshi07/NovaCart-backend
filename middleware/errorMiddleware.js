
const notFound = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

const errorHandler = (err, req, res, next) => {
  // Use an explicitly provided status code, if valid.
  let statusCode =
    Number.isInteger(err.statusCode) &&
    err.statusCode >= 400 &&
    err.statusCode <= 599
      ? err.statusCode
      : Number.isInteger(err.status) &&
          err.status >= 400 &&
          err.status <= 599
        ? err.status
        : 500;

  let message = err.message || "Internal Server Error";

  // Mongoose invalid ObjectId
  if (err.name === "CastError") {
    statusCode = 400;
    message = "Invalid resource ID";
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0];
    message = field
      ? `${field} already exists`
      : "Duplicate value already exists";
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors || {})
      .map((item) => item.message)
      .join(", ") || "Validation failed";
  }

  // Invalid JSON sent to express.json()
  if (
    err.type === "entity.parse.failed" ||
    err instanceof SyntaxError && err.status === 400 && "body" in err
  ) {
    statusCode = 400;
    message = "Invalid JSON request body";
  }

  // Do not expose internal server error details to clients.
  if (statusCode >= 500) {
    console.error("Server error:", err);
    message = "Internal Server Error";
  }

  return res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && statusCode >= 500
      ? { stack: err.stack }
      : {}),
  });
};

module.exports = {
  notFound,
  errorHandler,
};
