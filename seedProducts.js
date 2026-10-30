
require("dotenv").config();

const mongoose = require("mongoose");
const Product = require("./models/Product");

const products = [
  {
    name: "Nova X Pro",
    category: "Smartphones",
    price: 59999,
    oldPrice: 69999,
    originalPrice: 69999,
    rating: 4.9,
    reviews: 328,
    image: "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=800&q=80",
    badge: "BEST SELLER",
    description: "Experience powerful performance, stunning visuals, and a premium smartphone design with the Nova X Pro.",
    stock: 25,
  },
  {
    name: "AeroBook Ultra",
    category: "Laptops",
    price: 84999,
    oldPrice: 94999,
    originalPrice: 94999,
    rating: 4.8,
    reviews: 214,
    image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=800&q=80",
    badge: "NEW",
    description: "A sleek, powerful laptop designed for productivity, creativity, and everyday performance.",
    stock: 18,
  },
  {
    name: "AirBeat Pro",
    category: "Audio",
    price: 8999,
    oldPrice: 11999,
    originalPrice: 11999,
    rating: 4.7,
    reviews: 512,
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80",
    badge: "HOT",
    description: "Enjoy immersive sound and a premium listening experience with AirBeat Pro.",
    stock: 40,
  },
  {
    name: "UltraWatch X",
    category: "Wearables",
    price: 12499,
    oldPrice: 15999,
    originalPrice: 15999,
    rating: 4.8,
    reviews: 187,
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80",
    badge: "TRENDING",
    description: "A modern smartwatch that combines elegant design with everyday convenience.",
    stock: 30,
  },
  {
    name: "Vision 4K Monitor",
    category: "Monitors",
    price: 29999,
    oldPrice: 34999,
    originalPrice: 34999,
    rating: 4.9,
    reviews: 145,
    image: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=800&q=80",
    badge: "PREMIUM",
    description: "Upgrade your workspace with a premium monitor built for crisp visuals and productivity.",
    stock: 15,
  },
  {
    name: "Mecha RGB Keyboard",
    category: "Accessories",
    price: 4499,
    oldPrice: 5999,
    originalPrice: 5999,
    rating: 4.6,
    reviews: 276,
    image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80",
    badge: "GAMING",
    description: "A stylish RGB keyboard designed for responsive typing and immersive gaming.",
    stock: 50,
  },
  {
    name: "Precision Mouse",
    category: "Accessories",
    price: 2499,
    oldPrice: 3299,
    originalPrice: 3299,
    rating: 4.7,
    reviews: 198,
    image: "https://images.unsplash.com/photo-1527814050087-3793815479db?auto=format&fit=crop&w=800&q=80",
    badge: "POPULAR",
    description: "A precise, comfortable mouse for everyday work, creative tasks, and gaming.",
    stock: 45,
  },
  {
    name: "SoundBar Elite",
    category: "Audio",
    price: 14999,
    oldPrice: 18999,
    originalPrice: 18999,
    rating: 4.8,
    reviews: 119,
    image: "https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=800&q=80",
    badge: "LIMITED",
    description: "Bring rich, room-filling audio to your entertainment setup with SoundBar Elite.",
    stock: 20,
  },
];

async function seedProducts() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is missing in backend .env");
    }

    await mongoose.connect(process.env.MONGODB_URI);

    console.log("MongoDB connected.");

    for (const product of products) {
      await Product.findOneAndUpdate(
        { name: product.name },
        { $set: product },
        {
          upsert: true,
          new: true,
          runValidators: true,
        }
      );
    }

    const savedProducts = await Product.find(
      {},
      "_id name category price stock"
    ).sort({ name: 1 });

    console.log("\nNovaCart products saved successfully:");
    console.table(
      savedProducts.map((product) => ({
        id: product._id.toString(),
        name: product.name,
        category: product.category,
        price: product.price,
        stock: product.stock,
      }))
    );

    console.log("\nTotal products:", savedProducts.length);
  } catch (error) {
    console.error("Product seeding failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seedProducts();
