import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(
      process.env.MONGODB_URI,
      // dbName is passed as an option so URIs with a query string (?appName=...) stay valid.
      // Fail fast so the server starts quickly in offline (local file) mode.
      { dbName: DB_NAME, serverSelectionTimeoutMS: 5000 }
    );
    console.log(
      `\n MongoDB connected !! DB HOST: ${connectionInstance.connection.host}`
    );
  } catch (error) {
    console.log("MONGODB connection warning (running without database):", error.message);
  }
};

export default connectDB;
