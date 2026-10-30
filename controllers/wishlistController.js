
const mongoose = require("mongoose");
const Wishlist = require("../models/Wishlist");
const Product = require("../models/Product");

// @desc    Get the logged-in user's wishlist
// @route   GET /api/wishlist
// @access  Private
const getWishlist = async (req, res) => {
  try {
    let wishlist = await Wishlist.findOne({
      user: req.user.id,
    }).populate("products");

    if (!wishlist) {
      wishlist = await Wishlist.create({
        user: req.user.id,
        products: [],
      });

      wishlist = await Wishlist.findById(wishlist._id)
        .populate("products");
    }

    return res.status(200).json({
      success: true,
      count: wishlist.products.length,
      wishlist: wishlist.products,
    });
  } catch (error) {
    console.error("Get wishlist error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch wishlist",
    });
  }
};

// @desc    Add a product to wishlist
// @route   POST /api/wishlist
// @access  Private
const addToWishlist = async (req, res) => {
  try {
    const { productId } = req.body;

    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "A valid product ID is required",
      });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    let wishlist = await Wishlist.findOne({
      user: req.user.id,
    });

    if (!wishlist) {
      wishlist = new Wishlist({
        user: req.user.id,
        products: [],
      });
    }

    const alreadyExists = wishlist.products.some(
      (id) => id.toString() === productId
    );

    if (alreadyExists) {
      return res.status(200).json({
        success: true,
        message: "Product is already in your wishlist",
      });
    }

    wishlist.products.push(product._id);
    await wishlist.save();

    await wishlist.populate("products");

    return res.status(201).json({
      success: true,
      message: "Product added to wishlist successfully",
      count: wishlist.products.length,
      wishlist: wishlist.products,
    });
  } catch (error) {
    console.error("Add wishlist error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to add product to wishlist",
    });
  }
};

// @desc    Remove a product from wishlist
// @route   DELETE /api/wishlist/:productId
// @access  Private
const removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const wishlist = await Wishlist.findOne({
      user: req.user.id,
    });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: "Wishlist not found",
      });
    }

    const originalCount = wishlist.products.length;

    wishlist.products = wishlist.products.filter(
      (id) => id.toString() !== productId
    );

    if (wishlist.products.length === originalCount) {
      return res.status(404).json({
        success: false,
        message: "Product not found in wishlist",
      });
    }

    await wishlist.save();
    await wishlist.populate("products");

    return res.status(200).json({
      success: true,
      message: "Product removed from wishlist successfully",
      count: wishlist.products.length,
      wishlist: wishlist.products,
    });
  } catch (error) {
    console.error("Remove wishlist error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to remove product from wishlist",
    });
  }
};

// @desc    Clear the user's wishlist
// @route   DELETE /api/wishlist
// @access  Private
const clearWishlist = async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({
      user: req.user.id,
    });

    if (!wishlist) {
      return res.status(200).json({
        success: true,
        message: "Wishlist is already empty",
        wishlist: [],
        count: 0,
      });
    }

    wishlist.products = [];
    await wishlist.save();

    return res.status(200).json({
      success: true,
      message: "Wishlist cleared successfully",
      wishlist: [],
      count: 0,
    });
  } catch (error) {
    console.error("Clear wishlist error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to clear wishlist",
    });
  }
};

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  clearWishlist,
};
