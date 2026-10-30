
const Contact = require("../models/Contact");

// @desc    Submit a contact message
// @route   POST /api/contact
// @access  Public
const createContact = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validate required fields
    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof message !== "string" ||
      !message.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, email and message are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address",
      });
    }

    // Limit input lengths
    if (
      name.trim().length > 100 ||
      normalizedEmail.length > 254 ||
      (subject && String(subject).trim().length > 150) ||
      message.trim().length > 5000
    ) {
      return res.status(400).json({
        success: false,
        message: "One or more fields exceed the allowed length",
      });
    }

    const contact = await Contact.create({
      name: name.trim(),
      email: normalizedEmail,
      subject:
        typeof subject === "string" ? subject.trim() : "",
      message: message.trim(),
      status: "New",
    });

    return res.status(201).json({
      success: true,
      message: "Your message has been submitted successfully",
      contact: {
        id: contact._id,
        name: contact.name,
        email: contact.email,
        subject: contact.subject,
        status: contact.status,
        createdAt: contact.createdAt,
      },
    });
  } catch (error) {
    console.error("Create contact error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to submit your message. Please try again.",
    });
  }
};

// @desc    Get all contact messages
// @route   GET /api/contact
// @access  Admin
const getContacts = async (req, res) => {
  try {
    const contacts = await Contact.find()
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: contacts.length,
      contacts,
    });
  } catch (error) {
    console.error("Get contacts error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch contact messages",
    });
  }
};

// @desc    Update contact message status
// @route   PATCH /api/contact/:id/status
// @access  Admin
const updateContactStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const allowedStatuses = [
      "New",
      "Read",
      "Replied",
      "Archived",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
        allowedStatuses,
      });
    }

    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact message not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Contact status updated successfully",
      contact,
    });
  } catch (error) {
    const invalidId = error.name === "CastError";

    return res.status(invalidId ? 400 : 500).json({
      success: false,
      message: invalidId
        ? "Invalid contact message ID"
        : "Unable to update contact status",
    });
  }
};

// @desc    Delete a contact message
// @route   DELETE /api/contact/:id
// @access  Admin
const deleteContact = async (req, res) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact message not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Contact message deleted successfully",
    });
  } catch (error) {
    const invalidId = error.name === "CastError";

    return res.status(invalidId ? 400 : 500).json({
      success: false,
      message: invalidId
        ? "Invalid contact message ID"
        : "Unable to delete contact message",
    });
  }
};

module.exports = {
  createContact,
  getContacts,
  updateContactStatus,
  deleteContact,
};
