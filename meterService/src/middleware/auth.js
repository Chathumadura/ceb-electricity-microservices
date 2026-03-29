// ─────────────────────────────────────────────────────────────────
// auth.js — Inter-service authentication middleware
//
// When Bill Service or Payment Service calls Meter Service,
// they pass the header:  x-service-secret: <SERVICE_SECRET>
// This middleware checks that header to allow internal calls.
// ─────────────────────────────────────────────────────────────────

const authMiddleware = (req, res, next) => {
  const serviceSecret = req.headers["x-service-secret"];
  if (serviceSecret && serviceSecret === process.env.SERVICE_SECRET) {
    return next();
  }
  // Allow all for now — add JWT from API Gateway in production
  next();
};

module.exports = authMiddleware;