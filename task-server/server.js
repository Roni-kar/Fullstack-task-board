const express = require("express");
const webpush = require("web-push");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ================================================================
// PASTE YOUR KEYS BELOW (Keep the quotes!)
// ================================================================
const publicVapidKey = "BGiVewQ6FcFFwQArWDuUhi_7A1rjiKGCMvF5AHFm83fyTdIZ2eSbPsegndESPEj0ULwYgAvItepKgk7qRTrepdo";
const privateVapidKey = "YgdLT6a_YWIVtLSjVEHHsvNrNa_L6JHO4R8g3Hc2MsQ";

webpush.setVapidDetails(
  "mailto:test@test.com",
  publicVapidKey,
  privateVapidKey
);

// This list stores tasks temporarily
let notifications = []; 

// 1. Subscribe Endpoint
app.post("/subscribe", (req, res) => {
  const subscription = req.body;
  res.status(201).json({});
});

// 2. Schedule Endpoint
app.post("/schedule", (req, res) => {
  const { subscription, text, delay } = req.body;
  
  notifications.push({
    subscription,
    text,
    sendAt: Date.now() + delay
  });
  
  res.status(201).json({ message: "Reminder Scheduled" });
});

// 3. The Clock Watcher (Checks every 10 seconds)
setInterval(() => {
  const now = Date.now();
  
  const dueTasks = notifications.filter(n => n.sendAt <= now);
  notifications = notifications.filter(n => n.sendAt > now);

  dueTasks.forEach(task => {
    const payload = JSON.stringify({ title: "Task Reminder ⏰", body: task.text });
    
    webpush.sendNotification(task.subscription, payload).catch(err => {
      console.error(err);
    });
  });
}, 10000);

const port = 5000;
app.listen(port, () => console.log(`Server started on port ${port}`));