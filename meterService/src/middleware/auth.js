// Simple API key / internal service auth middleware
// For inter-service communication, services can pass x-service-secret header

const authMiddleware = (req, res, next) => {
  // Allow internal service-to-service calls (e.g., Bill Service calling Meter Service)
  const serviceSecret = req.headers["x-service-secret"];
  if (serviceSecret && serviceSecret === process.env.SERVICE_SECRET) {
    return next();
  }

  // For now, allow all requests (expand with JWT in production)
  // In a real system, verify JWT from API Gateway
  next();
};

module.exports = authMiddleware;