export class AppError extends Error {
  constructor(message, statusCode = 500, code = "internal_error", details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const code = err.code || "internal_error";

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message: err.message || "Unexpected error",
      details: err.details || null
    }
  });
};
