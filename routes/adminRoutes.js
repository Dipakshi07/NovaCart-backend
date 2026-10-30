
const express = require("express");
const router = express.Router();

const {
  getDashboardStats,
  getAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getAllUsers,
  getAllOrders,
  updateOrderStatus,
} = require("../controllers/adminController");

const {
  protect,
  adminOnly,
} = require("../middleware/authMiddleware");

// All admin routes require authentication and admin permission
router.use(protect, adminOnly);

// Dashboard statistics
router.get("/dashboard", getDashboardStats);

// Product management
router.get("/products", getAllProducts);
router.post("/products", createProduct);
router.put("/products/:id", updateProduct);
router.delete("/products/:id", deleteProduct);

// User management
router.get("/users", getAllUsers);

// Order management
router.get("/orders", getAllOrders);
router.patch("/orders/:id/status", updateOrderStatus);

module.exports = router;
