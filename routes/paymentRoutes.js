
const express = require("express");
const router = express.Router();

const {
  createPaymentOrder,
  verifyPayment,
  handlePaymentFailure,
} = require("../controllers/paymentController");

const { protect } = require("../middleware/authMiddleware");

router.use(protect);

router.post("/create-order", createPaymentOrder);
router.post("/verify", verifyPayment);
router.post("/failure", handlePaymentFailure);

module.exports = router;
