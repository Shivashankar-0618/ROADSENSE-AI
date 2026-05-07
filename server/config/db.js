const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not defined in .env file");
    }
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      appName: "roadsense-ai",
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    mongoose.connection.on("error",        (err) => console.error("❌ MongoDB error:", err));
    mongoose.connection.on("disconnected", ()    => console.warn("⚠️  MongoDB disconnected."));
    mongoose.connection.on("reconnected",  ()    => console.log("✅ MongoDB reconnected"));
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;