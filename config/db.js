
const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;

    // Check whether MongoDB URI is configured
    if (!mongoURI) {
      throw new Error(
        "MONGODB_URI is missing. Please configure it in your .env file."
      );
    }

    // Connect to MongoDB
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log("==================================");
    console.log("✅ MongoDB Connected Successfully");
    console.log(`📦 Database: ${mongoose.connection.name}`);
    console.log(`🌐 Host: ${mongoose.connection.host}`);
    console.log("==================================");

    return mongoose.connection;
  } catch (error) {
    console.error("❌ MongoDB Connection Failed!");
    console.error(`Reason: ${error.message}`);

    throw error;
  }
};

// Monitor connection events
mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ MongoDB disconnected");
});

mongoose.connection.on("reconnected", () => {
  console.log("✅ MongoDB reconnected");
});

mongoose.connection.on("error", (error) => {
  console.error("❌ MongoDB error:", error.message);
});

// Gracefully close the database connection
const disconnectDB = async () => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log("MongoDB connection closed.");
    }
  } catch (error) {
    console.error(
      "Error closing MongoDB connection:",
      error.message
    );
    throw error;
  }
};

module.exports = connectDB;
module.exports.disconnectDB = disconnectDB;
