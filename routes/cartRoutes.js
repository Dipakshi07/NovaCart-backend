
const express = require("express");
const router = express.Router();

const {
  getCart,
  addToCart,
  updateCartQuantity,
  removeFromCart,
  clearCart,
} = require("../controllers/cartController");

const { protect } = require("../middleware/authMiddleware");

// All cart routes require login.
router.use(protect);

router.get("/", getCart);
router.post("/", addToCart);
router.patch("/:productId", updateCartQuantity);
router.delete("/:productId", removeFromCart);
router.delete("/", clearCart);

module.exports = router;
