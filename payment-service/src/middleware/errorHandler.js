const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || "Internal Server Error";

    if (err.name === "ValidationError") {
        statusCode = 400;
        message = Object.values(err.errors)
            .map((item) => item.message)
            .join(", ");
    }

    if (err.name === "CastError") {
        statusCode = 400;
        message = `Invalid ${err.path}: ${err.value}`;
    }

    if (err.code === 11000) {
        statusCode = 409;
        message = "Duplicate key error. A unique field value already exists.";
    }

    res.status(statusCode).json({
        success: false,
        message,
    });
};

module.exports = errorHandler;