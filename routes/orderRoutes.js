
const express = require("express");
const router = express.Router();

const {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  getAllOrders,
  updateOrderStatus,
} = require("../../controllers/orderController");

const {
  protect,
  adminOnly,
} = require("../middleware/authMiddleware");

// =============================================
// CUSTOMER ROUTES
// =============================================

// Create COD order
router.post(
  "/",
  protect,
  createOrder
);

// Get logged-in user's orders
router.get(
  "/my-orders",
  protect,
  getMyOrders
);

// Get single logged-in user's order
router.get(
  "/:id",
  protect,
  getOrderById
);

// Cancel order
router.patch(
  "/:id/cancel",
  protect,
  cancelOrder
);

// =============================================
// ADMIN ROUTES
// =============================================

// Get all orders
router.get(
  "/",
  protect,
  adminOnly,
  getAllOrders
);

// Update order delivery status
router.patch(
  "/:id/status",
  protect,
  adminOnly,
  updateOrderStatus
);

module.exports = router;
