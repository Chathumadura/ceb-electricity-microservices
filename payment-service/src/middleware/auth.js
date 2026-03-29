const jwt = require("jsonwebtoken");

const protect = (roles = []) => (req, res, next) => {
    const h = req.headers.authorization;
    if (!h?.startsWith("Bearer ")) return res.status(401).json({ message: "No token" });
    try {
        const d = jwt.verify(h.split(" ")[1], process.env.JWT_SECRET);
        if (roles.length && !roles.includes(d.role)) return res.status(403).json({ message: "Forbidden" });
        req.user = d; next();
    } catch { res.status(401).json({ message: "Invalid token" }); }
};

module.exports = protect;