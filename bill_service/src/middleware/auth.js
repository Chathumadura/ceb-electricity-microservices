const jwt = require("jsonwebtoken");

const auth = (roles = []) => (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ message: "No token provided. Authorization denied." });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (roles.length && !roles.includes(decoded.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Attach decoded user info to request
    req.user = decoded;
    // Also save raw token so we can forward it when calling other services
    req.token = token;

    next();
  } catch (error) {
    return res.status(401).json({ message: "Token is not valid." });
  }
};

module.exports = auth;