
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const connectDB = require("./config/db");

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// CORS CONFIGURATION
// ==========================================

const allowedOrigins = (
  process.env.CLIENT_URL || "https://nova-cart-lovat.vercel.app/"
)
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow Postman, curl and server-to-server requests.
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = origin.replace(/\/$/, "");

    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    console.error("Blocked CORS origin:", origin);

    return callback(new Error("Not allowed by CORS"));
  },

  credentials: true,

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
  ],
};

app.use(cors(corsOptions));

// ==========================================
// BODY PARSING MIDDLEWARE
// ==========================================

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ==========================================
// API ROUTES
// ==========================================

const adminRoutes = require("./routes/adminRoutes");
const authRoutes = require("./routes/authRoutes");
const cartRoutes = require("./routes/cartRoutes");
const contactRoutes = require("./routes/contactRoutes");
const orderRoutes = require("./routes/orderRoutes");
const productRoutes = require("./routes/productRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

// ==========================================
// ROUTE MOUNTING
// ==========================================

app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/products", productRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/payments", paymentRoutes);

// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "NovaCart API is running successfully 🚀",
    port: PORT,
    database:
      mongoose.connection.readyState === 1
        ? "Connected"
        : "Disconnected",
  });
});

// ==========================================
// 404 HANDLER
// ==========================================

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ==========================================
// GLOBAL ERROR HANDLER
// ==========================================

app.use((err, req, res, next) => {
  console.error("Server Error:", err);

  if (res.headersSent) {
    return next(err);
  }

  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({
      success: false,
      message: "CORS error: This frontend origin is not allowed.",
    });
  }

  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

// ==========================================
// START SERVER
// ==========================================

let server;
let isShuttingDown = false;

const startServer = async () => {
  try {
    console.log("Connecting to MongoDB...");

    await connectDB();

    server = app.listen(PORT, () => {
      console.log("======================================");
      console.log("🚀 NovaCart Backend Started");
      console.log(`🌐 Server: https://novacart-backend-1.onrender.com`);
      console.log(`🔐 Auth: https://novacart-backend-1.onrender.com/api/auth`);
      console.log(`🛍️ Products: https://novacart-backend-1.onrender.com/api/products`);
      console.log(`🛒 Cart: https://novacart-backend-1.onrender.com/api/cart`);
      console.log(`📦 Orders: https://novacart-backend-1.onrender.com/api/orders`);
      console.log(`💳 Payments: https://novacart-backend-1.onrender.com/api/payments`);
      console.log("======================================");
    });

    server.on("error", (error) => {
      console.error("HTTP Server error:", error);

      if (error.code === "EADDRINUSE") {
        console.error(`Port ${PORT} is already in use.`);
      }

      process.exit(1);
    });
  } catch (error) {
    console.error("❌ Server startup failed:", error.message);
    process.exit(1);
  }
};

// ==========================================
// GRACEFUL SHUTDOWN
// ==========================================

const shutdown = async (signal) => {
  if (isShuttingDown) return;

  isShuttingDown = true;

  console.log(`\n${signal} received. Closing NovaCart server...`);

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }

    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }

    console.log("MongoDB connection closed.");
    console.log("NovaCart server stopped successfully.");

    process.exit(0);
  } catch (error) {
    console.error("Shutdown failed:", error.message);
    process.exit(1);
  }
};

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

// ==========================================
// START APPLICATION
// ==========================================

if (require.main === module) {
  startServer();
}

module.exports = app;
