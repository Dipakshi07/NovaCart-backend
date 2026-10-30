
const express = require("express");
const router = express.Router();

const {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  clearWishlist,
} = require("../../controllers/wishlistController");

const { protect } = require("../middleware/authMiddleware");

// All wishlist routes require authentication
router.use(protect);

// Get the user's wishlist
router.get("/", getWishlist);

// Add a product to the wishlist
router.post("/", addToWishlist);

// Remove a product from the wishlist
router.delete("/:productId", removeFromWishlist);

// Clear the entire wishlist
router.delete("/", clearWishlist);

module.exports = router;
