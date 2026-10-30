
const mongoose = require("mongoose");

/*
 * Individual product inside an order
 */
const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    image: {
      type: String,
      default: "",
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Quantity must be a whole number",
      },
    },
  },
  { _id: false }
);

/*
 * Shipping address
 */
const shippingAddressSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    address: {
      type: String,
      required: true,
      trim: true,
    },

    city: {
      type: String,
      required: true,
      trim: true,
    },

    state: {
      type: String,
      required: true,
      trim: true,
    },

    postalCode: {
      type: String,
      required: true,
      trim: true,
    },

    country: {
      type: String,
      default: "India",
      trim: true,
    },
  },
  { _id: false }
);

/*
 * Order tracking history
 *
 * Every time admin changes order status,
 * a new entry is added here.
 */
const trackingHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: [
        "Ordered",
        "Shipping",
        "Out for Delivery",
        "Delivered",
        "Cancelled",
      ],
      required: true,
    },

    date: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

/*
 * Main Order Schema
 */
const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    items: {
      type: [orderItemSchema],
      required: true,

      validate: {
        validator: (items) =>
          Array.isArray(items) && items.length > 0,

        message:
          "An order must contain at least one product",
      },
    },

    shippingAddress: {
      type: shippingAddressSchema,
      required: true,
    },

    /*
     * Payment method
     */
    paymentMethod: {
      type: String,
      enum: ["COD", "ONLINE"],
      default: "COD",
      required: true,
    },

    /*
     * Payment status
     */
    paymentStatus: {
      type: String,
      enum: [
        "Pending",
        "Paid",
        "Failed",
        "Refunded",
      ],
      default: "Pending",
    },

    /*
     * Razorpay information
     */
    razorpayOrderId: {
      type: String,
      default: null,
      sparse: true,
    },

    razorpayPaymentId: {
      type: String,
      default: null,
    },

    razorpaySignature: {
      type: String,
      default: null,
      select: false,
    },

    /*
     * Current delivery status
     *
     * Customer-facing status:
     *
     * Ordered
     * Shipping
     * Out for Delivery
     * Delivered
     * Cancelled
     */
    status: {
      type: String,

      enum: [
        "Ordered",
        "Shipping",
        "Out for Delivery",
        "Delivered",
        "Cancelled",
      ],

      default: "Ordered",

      required: true,
    },

    /*
     * Complete tracking timeline
     */
    trackingHistory: {
      type: [trackingHistorySchema],

      default: function () {
        return [
          {
            status: "Ordered",
            date: new Date(),
          },
        ];
      },
    },

    /*
     * Important delivery dates
     */
    orderedAt: {
      type: Date,
      default: Date.now,
    },

    shippedAt: {
      type: Date,
      default: null,
    },

    outForDeliveryAt: {
      type: Date,
      default: null,
    },

    deliveredAt: {
      type: Date,
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    /*
     * Estimated delivery date
     */
    expectedDeliveryDate: {
      type: Date,
      default: null,
    },

    /*
     * Total order amount
     */
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
  },

  {
    timestamps: true,
  }
);

/*
 * Useful indexes
 */
orderSchema.index({
  user: 1,
  createdAt: -1,
});

orderSchema.index({
  status: 1,
  createdAt: -1,
});

orderSchema.index(
  {
    razorpayOrderId: 1,
  },
  {
    sparse: true,
  }
);

module.exports = mongoose.model(
  "Order",
  orderSchema
);
