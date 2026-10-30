
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Cart = require("../models/Cart");

// ---------------------------------------------
// HELPERS
// ---------------------------------------------

const validateShippingAddress = (address) => {
  const requiredFields = [
    "fullName",
    "phone",
    "address",
    "city",
    "state",
    "postalCode",
  ];

  if (!address || typeof address !== "object" || Array.isArray(address)) {
    return "Shipping address is required";
  }

  for (const field of requiredFields) {
    if (
      typeof address[field] !== "string" ||
      !address[field].trim()
    ) {
      return `${field} is required`;
    }
  }

  if (!/^[0-9]{10}$/.test(address.phone.trim())) {
    return "Please enter a valid 10-digit phone number";
  }

  if (!/^[0-9]{6}$/.test(address.postalCode.trim())) {
    return "Please enter a valid 6-digit postal code";
  }

  return null;
};

const formatShippingAddress = (address) => ({
  fullName: address.fullName.trim(),
  phone: address.phone.trim(),
  address: address.address.trim(),
  city: address.city.trim(),
  state: address.state.trim(),
  postalCode: address.postalCode.trim(),
  country:
    typeof address.country === "string" && address.country.trim()
      ? address.country.trim()
      : "India",
});

const sendError = (res, error, fallbackMessage) => {
  console.error(fallbackMessage, error);

  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.statusCode ? error.message : fallbackMessage,
  });
};

const isValidId = (id) => mongoose.isValidObjectId(id);

// ---------------------------------------------
// CREATE COD ORDER
// POST /api/orders
// PRIVATE
// ---------------------------------------------

const createOrder = async (req, res) => {
  let session;

  try {
    const {
      shippingAddress,
      paymentMethod = "COD",
    } = req.body;

    const addressError = validateShippingAddress(shippingAddress);

    if (addressError) {
      return res.status(400).json({
        success: false,
        message: addressError,
      });
    }

    if (paymentMethod !== "COD") {
      return res.status(400).json({
        success: false,
        message: "Online payments must use Razorpay checkout.",
      });
    }

    session = await mongoose.startSession();

    let createdOrder;

    await session.withTransaction(async () => {
      const cart = await Cart.findOne({
        user: req.user.id,
      })
        .populate("items.product")
        .session(session);

      if (!cart || !cart.items || cart.items.length === 0) {
        const error = new Error("Your cart is empty");
        error.statusCode = 400;
        throw error;
      }

      const orderItems = [];
      let totalAmount = 0;

      for (const item of cart.items) {
        const product = item.product;

        if (!product) {
          const error = new Error(
            "A product in your cart no longer exists"
          );
          error.statusCode = 400;
          throw error;
        }

        if (
          !Number.isInteger(item.quantity) ||
          item.quantity < 1
        ) {
          const error = new Error(
            `Invalid quantity for ${product.name}`
          );
          error.statusCode = 400;
          throw error;
        }

        const price = Number(product.price);

        if (!Number.isFinite(price) || price <= 0) {
          const error = new Error(
            `Invalid price for ${product.name}`
          );
          error.statusCode = 400;
          throw error;
        }

        // Atomically check and reserve stock.
        const updatedProduct = await Product.findOneAndUpdate(
          {
            _id: product._id,
            stock: { $gte: item.quantity },
          },
          {
            $inc: { stock: -item.quantity },
          },
          {
            new: true,
            session,
          }
        );

        if (!updatedProduct) {
          const error = new Error(
            `Insufficient stock for ${product.name}`
          );
          error.statusCode = 400;
          throw error;
        }

        orderItems.push({
          product: product._id,
          name: product.name,
          image: product.image || "",
          price,
          quantity: item.quantity,
        });

        totalAmount += price * item.quantity;
      }

      totalAmount = Number(totalAmount.toFixed(2));

      if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
        const error = new Error("Invalid order amount");
        error.statusCode = 400;
        throw error;
      }

      const orders = await Order.create(
        [
          {
            user: req.user.id,
            items: orderItems,
            shippingAddress: formatShippingAddress(shippingAddress),
            paymentMethod: "COD",
            paymentStatus: "Pending",
            status: "Pending",
            totalAmount,
          },
        ],
        { session }
      );

      createdOrder = orders[0];

      cart.items = [];
      await cart.save({ session });
    });

    return res.status(201).json({
      success: true,
      message: "Cash on Delivery order placed successfully",
      order: createdOrder,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Unable to place COD order. Please try again."
    );
  } finally {
    if (session) await session.endSession();
  }
};

// ---------------------------------------------
// GET MY ORDERS
// GET /api/orders/my-orders
// PRIVATE
// ---------------------------------------------

const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      user: req.user.id,
    })
      .populate("items.product", "name image")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    return sendError(res, error, "Unable to fetch your orders");
  }
};

// ---------------------------------------------
// GET SINGLE ORDER
// GET /api/orders/:id
// PRIVATE
// ---------------------------------------------

const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const order = await Order.findOne({
      _id: id,
      user: req.user.id,
    }).populate("items.product", "name image");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    return sendError(res, error, "Unable to fetch order details");
  }
};

// ---------------------------------------------
// RESTORE STOCK HELPER
// ---------------------------------------------

const restoreOrderStock = async (order, session) => {
  for (const item of order.items) {
    const productId = item.product?._id || item.product;

    if (!productId) continue;

    await Product.updateOne(
      { _id: productId },
      {
        $inc: { stock: item.quantity },
      },
      { session }
    );
  }
};

// ---------------------------------------------
// CANCEL USER ORDER
// PATCH /api/orders/:id/cancel
// PRIVATE
// ---------------------------------------------

const cancelOrder = async (req, res) => {
  let session;

  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    session = await mongoose.startSession();

    let cancelledOrder;

    await session.withTransaction(async () => {
      const order = await Order.findOne({
        _id: id,
        user: req.user.id,
      }).session(session);

      if (!order) {
        const error = new Error("Order not found");
        error.statusCode = 404;
        throw error;
      }

      if (order.status !== "Pending") {
        const error = new Error(
          "Only pending orders can be cancelled"
        );
        error.statusCode = 400;
        throw error;
      }

      if (
        order.paymentMethod === "ONLINE" &&
        order.paymentStatus === "Paid"
      ) {
        const error = new Error(
          "Paid online orders require a refund before cancellation."
        );
        error.statusCode = 400;
        throw error;
      }

      await restoreOrderStock(order, session);

      order.status = "Cancelled";

      cancelledOrder = await order.save({ session });
    });

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      order: cancelledOrder,
    });
  } catch (error) {
    return sendError(res, error, "Unable to cancel order");
  } finally {
    if (session) await session.endSession();
  }
};

// ---------------------------------------------
// ADMIN: GET ALL ORDERS
// GET /api/orders
// ADMIN
// ---------------------------------------------

const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("user", "name email")
      .populate("items.product", "name image")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    return sendError(res, error, "Unable to fetch orders");
  }
};

// ---------------------------------------------
// ADMIN: UPDATE ORDER STATUS
// PATCH /api/orders/:id/status
// ADMIN
// ---------------------------------------------

const updateOrderStatus = async (req, res) => {
  let session;

  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = [
      "Pending",
      "Processing",
      "Shipped",
      "Delivered",
      "Cancelled",
    ];

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status",
        allowedStatuses,
      });
    }

    session = await mongoose.startSession();

    let updatedOrder;

    await session.withTransaction(async () => {
      const order = await Order.findById(id).session(session);

      if (!order) {
        const error = new Error("Order not found");
        error.statusCode = 404;
        throw error;
      }

      if (
        order.status === "Cancelled" ||
        order.status === "Delivered"
      ) {
        const error = new Error(
          `This order is already ${order.status.toLowerCase()}`
        );
        error.statusCode = 400;
        throw error;
      }

      if (status === "Cancelled") {
        if (
          order.paymentMethod === "ONLINE" &&
          order.paymentStatus === "Paid"
        ) {
          const error = new Error(
            "Paid online orders must be refunded before cancellation."
          );
          error.statusCode = 400;
          throw error;
        }

        await restoreOrderStock(order, session);
      }

      // Delivered does NOT automatically mean cash collected.
      // COD payment remains Pending until separately confirmed.
      order.status = status;

      updatedOrder = await order.save({ session });
    });

    updatedOrder = await Order.findById(id)
      .populate("user", "name email")
      .populate("items.product", "name image");

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      order: updatedOrder,
    });
  } catch (error) {
    return sendError(res, error, "Unable to update order status");
  } finally {
    if (session) await session.endSession();
  }
};

// ---------------------------------------------
// EXPORT
// ---------------------------------------------

module.exports = {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  getAllOrders,
  updateOrderStatus,
};
