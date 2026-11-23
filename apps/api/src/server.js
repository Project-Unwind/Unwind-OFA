const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();

app.use(helmet());

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173"
}));

app.use(express.json({ limit: "20kb" }));

app.use("/api", rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
}));

app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    service: "unwind-ofa-api",
    message: "Unwind OFA API is running!"
  });
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Unwind OFA API running on port ${PORT}`);
});