
const Product = require("../models/Product");
const User = require("../models/User");
const Order = require("../models/Order");

// @desc    Get admin dashboard statistics
// @route   GET /api/admin/dashboard
// @access  Admin
const getDashboardStats = async (req, res) => {
  try {
    const [
      totalProducts,
      totalUsers,
      totalOrders,
      pendingOrders,
      recentOrders,
      revenueResult,
      lowStockProducts,
    ] = await Promise.all([
      Product.countDocuments(),
      User.countDocuments(),
      Order.countDocuments(),
      Order.countDocuments({ status: "Pending" }),

      Order.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("user", "name email")
        .lean(),

      Order.aggregate([
        {
          $match: {
            status: { $nin: ["Cancelled", "Failed"] },
            paymentStatus: { $ne: "Refunded" },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$totalAmount" },
          },
        },
      ]),

      Product.find({ stock: { $lte: 5 } })
        .select("name price stock image")
        .sort({ stock: 1 })
        .limit(10)
        .lean(),
    ]);

    const totalRevenue = revenueResult[0]?.totalRevenue || 0;

    return res.status(200).json({
      success: true,
      message: "Dashboard statistics fetched successfully",
      stats: {
        totalProducts,
        totalUsers,
        totalOrders,
        pendingOrders,
        totalRevenue,
        recentOrders,
        lowStockProducts,
      },
    });
  } catch (error) {
    console.error("Admin dashboard error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch dashboard statistics",
    });
  }
};

// @desc    Get all products for admin
// @route   GET /api/admin/products
// @access  Admin
const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    console.error("Get admin products error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch products",
    });
  }
};

// @desc    Create a product
// @route   POST /api/admin/products
// @access  Admin
const createProduct = async (req, res) => {
  try {
    const {
      name,
      category,
      price,
      oldPrice,
      originalPrice,
      image,
      description,
      rating,
      reviews,
      badge,
      stock,
    } = req.body;

    if (
      !name ||
      !category ||
      price === undefined ||
      !Number.isFinite(Number(price)) ||
      Number(price) < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid name, category and price are required",
      });
    }

    const product = await Product.create({
      name: name.trim(),
      category: category.trim(),
      price: Number(price),
      oldPrice: Number(oldPrice) || 0,
      originalPrice: Number(originalPrice) || 0,
      image: image || "",
      description: description || "",
      rating: Number(rating) || 0,
      reviews: Number(reviews) || 0,
      badge: badge || "",
      stock: Math.max(0, Number(stock) || 0),
    });

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    console.error("Create product error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to create product",
    });
  }
};

// @desc    Update a product
// @route   PUT /api/admin/products/:id
// @access  Admin
const updateProduct = async (req, res) => {
  try {
    const allowedFields = [
      "name",
      "category",
      "price",
      "oldPrice",
      "originalPrice",
      "image",
      "description",
      "rating",
      "reviews",
      "badge",
      "stock",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const numericFields = [
      "price",
      "oldPrice",
      "originalPrice",
      "rating",
      "reviews",
      "stock",
    ];

    for (const field of numericFields) {
      if (updates[field] !== undefined) {
        const value = Number(updates[field]);

        if (!Number.isFinite(value) || value < 0) {
          return res.status(400).json({
            success: false,
            message: `${field} must be a valid non-negative number`,
          });
        }

        updates[field] = value;
      }
    }

    if (updates.name !== undefined) {
      if (typeof updates.name !== "string" || !updates.name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Product name cannot be empty",
        });
      }

      updates.name = updates.name.trim();
    }

    if (updates.category !== undefined) {
      if (
        typeof updates.category !== "string" ||
        !updates.category.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "Product category cannot be empty",
        });
      }

      updates.category = updates.category.trim();
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    const isInvalidId = error.name === "CastError";

    return res.status(isInvalidId ? 400 : 500).json({
      success: false,
      message: isInvalidId
        ? "Invalid product ID"
        : "Unable to update product",
    });
  }
};

// @desc    Delete a product
// @route   DELETE /api/admin/products/:id
// @access  Admin
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    const isInvalidId = error.name === "CastError";

    return res.status(isInvalidId ? 400 : 500).json({
      success: false,
      message: isInvalidId
        ? "Invalid product ID"
        : "Unable to delete product",
    });
  }
};

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Admin
const getAllUsers = async (req, res) => {
  try {
    // Exclude password hashes from the response.
    const users = await User.find()
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error("Get admin users error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch users",
    });
  }
};

// @desc    Get all orders
// @route   GET /api/admin/orders
// @access  Admin
const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    console.error("Get admin orders error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch orders",
    });
  }
};

// @desc    Update order status
// @route   PATCH /api/admin/orders/:id/status
// @access  Admin
const updateOrderStatus = async (req, res) => {
  try {
    const allowedStatuses = [
      "Pending",
      "Processing",
      "Shipped",
      "Delivered",
      "Cancelled",
    ];

    const { status } = req.body;

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status",
        allowedStatuses,
      });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      order,
    });
  } catch (error) {
    const isInvalidId = error.name === "CastError";

    return res.status(isInvalidId ? 400 : 500).json({
      success: false,
      message: isInvalidId
        ? "Invalid order ID"
        : "Unable to update order status",
    });
  }
};

module.exports = {
  getDashboardStats,
  getAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getAllUsers,
  getAllOrders,
  updateOrderStatus,
};
