
const crypto = require("crypto");
const mongoose = require("mongoose");

const razorpay = require("../utils/razorpay");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Cart = require("../models/Cart");

// Validate shipping address
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
      return `Shipping address field '${field}' is required`;
    }
  }

  return null;
};

// CREATE RAZORPAY ORDER
// POST /api/payments/create-order
const createPaymentOrder = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { shippingAddress } = req.body;

    const addressError = validateShippingAddress(shippingAddress);

    if (addressError) {
      return res.status(400).json({
        success: false,
        message: addressError,
      });
    }

    let responseData;

    await session.withTransaction(async () => {
      const cart = await Cart.findOne({ user: req.user.id })
        .populate("items.product")
        .session(session);

      if (!cart || cart.items.length === 0) {
        const error = new Error("Your cart is empty");
        error.statusCode = 400;
        throw error;
      }

      const orderItems = [];
      let totalAmount = 0;

      // Calculate amount from database products, never from frontend
      for (const item of cart.items) {
        const product = item.product;

        if (!product) {
          const error = new Error("A product in your cart no longer exists");
          error.statusCode = 400;
          throw error;
        }

        if (!Number.isInteger(item.quantity) || item.quantity < 1) {
          const error = new Error("Invalid product quantity");
          error.statusCode = 400;
          throw error;
        }

        const price = Number(product.price);

        if (!Number.isFinite(price) || price <= 0) {
          const error = new Error("Invalid product price");
          error.statusCode = 400;
          throw error;
        }

        if (Number(product.stock) < item.quantity) {
          const error = new Error(`Insufficient stock for ${product.name}`);
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

      if (!Number.isSafeInteger(Math.round(totalAmount * 100))) {
        const error = new Error("Invalid payment amount");
        error.statusCode = 400;
        throw error;
      }

      // Create Razorpay order in paise (INR × 100)
      const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(totalAmount * 100),
        currency: "INR",
        receipt: `order_${new mongoose.Types.ObjectId()}`,
        notes: {
          userId: String(req.user.id),
        },
      });

      // Reserve stock atomically
      for (const item of orderItems) {
        const updatedProduct = await Product.findOneAndUpdate(
          {
            _id: item.product,
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
            `Insufficient stock for ${item.name}`
          );
          error.statusCode = 400;
          throw error;
        }
      }

      const order = new Order({
        user: req.user.id,
        items: orderItems,
        shippingAddress: {
          fullName: shippingAddress.fullName.trim(),
          phone: shippingAddress.phone.trim(),
          address: shippingAddress.address.trim(),
          city: shippingAddress.city.trim(),
          state: shippingAddress.state.trim(),
          postalCode: shippingAddress.postalCode.trim(),
          country:
            typeof shippingAddress.country === "string"
              ? shippingAddress.country.trim()
              : "India",
        },
        paymentMethod: "ONLINE",
        paymentStatus: "Pending",
        status: "Pending",
        totalAmount,
        razorpayOrderId: razorpayOrder.id,
      });

      await order.save({ session });

      // Cart is cleared only after order creation succeeds
      cart.items = [];
      await cart.save({ session });

      responseData = {
        orderId: order._id,
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        key: process.env.RAZORPAY_KEY_ID,
      };
    });

    return res.status(201).json({
      success: true,
      message: "Payment order created successfully",
      ...responseData,
    });
  } catch (error) {
    console.error("Create payment order error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.statusCode
          ? error.message
          : "Unable to create payment order",
    });
  } finally {
    await session.endSession();
  }
};

// VERIFY RAZORPAY PAYMENT
// POST /api/payments/verify
const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment verification details are incomplete",
      });
    }

    const order = await Order.findOne({
      razorpayOrderId: razorpay_order_id,
      user: req.user.id,
      paymentMethod: "ONLINE",
    }).select("+razorpaySignature");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Payment order not found",
      });
    }

    // Idempotent response for an already verified payment
    if (order.paymentStatus === "Paid") {
      if (order.razorpayPaymentId === razorpay_payment_id) {
        return res.status(200).json({
          success: true,
          message: "Payment already verified",
          order,
        });
      }

      return res.status(409).json({
        success: false,
        message: "This order has already been paid",
      });
    }

    if (order.status === "Cancelled") {
      return res.status(400).json({
        success: false,
        message: "This order has been cancelled",
      });
    }

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const signatureBuffer = Buffer.from(generatedSignature, "hex");
    const receivedBuffer = Buffer.from(razorpay_signature, "hex");

    const signatureIsValid =
      signatureBuffer.length === receivedBuffer.length &&
      signatureBuffer.length > 0 &&
      crypto.timingSafeEqual(signatureBuffer, receivedBuffer);

    if (!signatureIsValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }

    // Confirm payment status directly with Razorpay as well
    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    if (
      payment.order_id !== razorpay_order_id ||
      payment.currency !== "INR" ||
      payment.amount !== Math.round(order.totalAmount * 100) ||
      payment.status !== "captured"
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment is not captured or payment details do not match",
      });
    }

    order.paymentStatus = "Paid";
    order.razorpayPaymentId = razorpay_payment_id;
    order.razorpaySignature = razorpay_signature;

    await order.save();

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      order,
    });
  } catch (error) {
    console.error("Payment verification error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to verify payment",
    });
  }
};

// HANDLE PAYMENT FAILURE
// POST /api/payments/failure
const handlePaymentFailure = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { razorpayOrderId } = req.body;

    if (!razorpayOrderId) {
      return res.status(400).json({
        success: false,
        message: "Razorpay order ID is required",
      });
    }

    let updatedOrder;

    await session.withTransaction(async () => {
      const order = await Order.findOne({
        razorpayOrderId,
        user: req.user.id,
        paymentMethod: "ONLINE",
      }).session(session);

      if (!order) {
        const error = new Error("Order not found");
        error.statusCode = 404;
        throw error;
      }

      // Do not cancel or restore stock if payment is already successful
      if (order.paymentStatus === "Paid") {
        const error = new Error("This payment has already been completed");
        error.statusCode = 409;
        throw error;
      }

      if (order.status === "Cancelled") {
        updatedOrder = order;
        return;
      }

      for (const item of order.items) {
        await Product.updateOne(
          { _id: item.product },
          { $inc: { stock: item.quantity } },
          { session }
        );
      }

      order.paymentStatus = "Failed";
      order.status = "Cancelled";

      updatedOrder = await order.save({ session });
    });

    return res.status(200).json({
      success: true,
      message: "Failed payment order cancelled",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Payment failure handler error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Unable to update failed payment",
    });
  } finally {
    await session.endSession();
  }
};

module.exports = {
  createPaymentOrder,
  verifyPayment,
  handlePaymentFailure,
};
