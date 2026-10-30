
const express = require("express");
const router = express.Router();

const {
  getProducts,
  getProductById,
} = require("../controllers/productController");

// Get all products with optional search, filters, sorting and pagination
router.get("/", getProducts);

// Get a single product by MongoDB ID
router.get("/:id", getProductById);

module.exports = router;
