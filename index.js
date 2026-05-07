require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const User = require("./models/User");
const Exercise = require("./models/Exercise");

app.use(cors());
app.use(express.urlencoded({ extended: false })); // parse URL-encoded bodies for HTML form submissions
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
});

app.post("/api/users", async (req, res) => {
  try {
    const newUser = new User({ username: req.body.username });
    const savedUser = await newUser.save();
    res.json({ username: savedUser.username, _id: savedUser._id });
  } catch (err) {
    res.status(500).json({ error: "Failed to create user" });
  }
});

app.get("/api/users", async (req, res) => {
  const users = await User.find({});
  res.json(users.map((u) => ({ username: u.username, _id: u._id }))); // return specific projection for all users
});

app.post("/api/users/:_id/exercises", async (req, res) => {
  try {
    const user = await User.findById(req.params._id);
    if (!user) return res.status(404).json({ error: "User not found" });

    // handle optional date field with fallback to current timestamp
    const date = req.body.date ? new Date(req.body.date) : new Date();
    if (isNaN(date.getTime()))
      return res.status(400).json({ error: "Invalid date" });

    const exercise = new Exercise({
      userId: user._id,
      description: req.body.description,
      duration: Number(req.body.duration),
      date: date,
    });

    const savedExercise = await exercise.save();
    res.json({
      username: user.username,
      description: savedExercise.description,
      duration: savedExercise.duration,
      date: savedExercise.date.toDateString(), // format date to readable string
      _id: user._id.toString(),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to add exercise" });
  }
});

// log and filtering routes
app.get("/api/users/:_id/logs", async (req, res) => {
  try {
    const { from, to, limit } = req.query;
    const user = await User.findById(req.params._id);
    if (!user) return res.status(404).json({ error: "User not found" });

    let filter = { userId: user._id };

    // build date range filters based on query parameters
    if (from || to) {
      filter.date = {};
      if (from) {
        const fromDate = new Date(from);
        if (isNaN(fromDate.getTime())) {
          return res.status(400).json({ error: "Invalid from date" });
        }
        filter.date.$gte = fromDate;
      }
      if (to) {
        const toDate = new Date(to);
        if (isNaN(toDate.getTime())) {
          return res.status(400).json({ error: "Invalid to date" });
        }
        filter.date.$lte = toDate;
      }
    }

    let query = Exercise.find(filter).select("description duration date");

    if (limit) {
      const lim = Number(limit);
      if (isNaN(lim) || lim <= 0) {
        return res.status(400).json({ error: "Invalid limit value" });
      }
      query = query.limit(lim);
    }

    const exercises = await query.exec();

    res.json({
      username: user.username,
      count: exercises.length,
      _id: user._id,
      log: exercises.map((e) => ({
        description: e.description,
        duration: e.duration,
        date: e.date.toDateString(),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get logs" });
  }
});

const port = process.env.PORT || 3000;

// database connection and server initialization
mongoose.connect(process.env.MONGO_URI);

mongoose.connection.once("open", () => {
  app.listen(port, () => {
    console.log(`Database Connected. Server running on port ${port}`);
  });
});

mongoose.connection.on("error", (err) => {
  console.error("MongoDB connection error:", err);
});
