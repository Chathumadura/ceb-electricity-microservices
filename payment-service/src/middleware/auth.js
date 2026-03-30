const jwt = require("jsonwebtoken");

const auth = (roles = []) => {
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    return (req, res, next) => {
        try {
            const authHeader = req.headers.authorization;

            // Check if token exists
            if (!authHeader) {
                return res.status(401).json({
                    message: "No token provided. Authorization denied.",
                });
            }

            const [scheme, token] = authHeader.split(" ");
            if (scheme?.toLowerCase() !== "bearer" || !token) {
                return res.status(401).json({
                    message: "Invalid authorization header format.",
                });
            }

            if (!process.env.JWT_SECRET) {
                return res.status(500).json({
                    message: "JWT configuration error.",
                });
            }

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Role-based authorization
            if (allowedRoles.length > 0 && !allowedRoles.includes(decoded.role)) {
                return res.status(403).json({
                    message: "Forbidden: You don't have access",
                });
            }

            // Attach user & token to request
            req.user = decoded;
            req.token = token;

            next();
        } catch (error) {
            if (error.name === "TokenExpiredError") {
                return res.status(401).json({
                    message: "Token has expired.",
                });
            }

            if (error.name === "JsonWebTokenError") {
                return res.status(401).json({
                    message: "Token is invalid.",
                });
            }

            return res.status(401).json({
                message: "Token is not valid or expired.",
            });
        }
    };
};

module.exports = auth;