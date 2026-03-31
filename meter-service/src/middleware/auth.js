const jwt = require('jsonwebtoken');

// ─────────────────────────────────────────────────────────────────
// protect middleware — Meter Service
//
// This works with Customer Service JWT token.
// Customer logs in via Customer Service → gets a token
// That same token is sent to Meter Service in the header:
//   Authorization: Bearer <token>
// This middleware verifies that token using the same JWT_SECRET
// ─────────────────────────────────────────────────────────────────

const protect = (roles = []) => (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    try {
      // Extract token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify using same JWT_SECRET as Customer Service
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Check roles if specified
      if (roles.length && !roles.includes(decoded.role)) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized, insufficient permissions',
        });
      }

      // Attach customer info to request
      // decoded contains: { id, customerId, name, email, iat, exp }
      req.customer = decoded;

      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, invalid token',
      });
    }
  } else {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no token provided',
    });
  }
};

module.exports = protect;