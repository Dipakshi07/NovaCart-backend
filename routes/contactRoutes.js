
const express = require("express");
const router = express.Router();

const {
  createContact,
  getContacts,
  updateContactStatus,
  deleteContact,
} = require("../controllers/contactController");

const {
  protect,
  adminOnly,
} = require("../middleware/authMiddleware");

// Public route: Customer contact form submit karega
router.post("/", createContact);

// Admin-only routes
router.get("/", protect, adminOnly, getContacts);

router.patch("/:id/status", protect, adminOnly, updateContactStatus);

router.delete("/:id", protect, adminOnly, deleteContact);

module.exports = router;
