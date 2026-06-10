const express = require("express");
const path = require("path");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const imageAnalyzeRoutes = require("./routes/imageAnalyzeRoutes");
const itineraryRoutes = require("./routes/itineraryRoutes");

const app = express();

app.use(cors());

app.use(express.json({ limit: "50mb" }));
app.use(express.static(path.join(__dirname, "../public")));

app.use("/api/auth", authRoutes);
app.use("/api", imageAnalyzeRoutes);
app.use("/api/itineraries", itineraryRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "서버 오류가 발생했습니다." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
