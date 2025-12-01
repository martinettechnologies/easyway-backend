// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Resend } from "resend";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// parse JSON + urlencoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS settings
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://darkblue-fly-926171.hostingersite.com", // live test site
  "https://easywayloan.com",
  "https://www.easywayloan.com",// live site
];

app.use(
  cors({
    origin: (origin, cb) => {
      // origin can be undefined for tools or curl – allow that
      if (!origin || allowedOrigins.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error("CORS not allowed"), false);
      }
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

// STEP 2: handle preflight for this route
app.options("/api/send-form", cors());

// Resend setup
const resend = new Resend(process.env.RESEND_API_KEY);
const SEND_TO_EMAIL = process.env.SEND_TO_EMAIL;

// API ROUTE
app.post("/api/send-form", async (req, res) => {
  const { name, email, phone, loanType, message, sourcePage } = req.body;

  if (!name || !email || !phone) {
    return res
      .status(400)
      .json({ success: false, error: "Missing required fields" });
  }

  let subjectLine = "New Submission Received";

  if (sourcePage === "Application Form") {
    subjectLine = `New Loan Application from ${name}`;
  } else if (sourcePage === "Contact Form") {
    subjectLine = `New Contact Request from ${name}`;
  } else if (sourcePage === "Home Contact") {
    subjectLine = `New Enquiry from ${name}`;
  } else {
    subjectLine = `New Enquiry from ${name}`;
  }

  try {
    const { error } = await resend.emails.send({
      from: "Easy Way Loans <onboarding@resend.dev>",
      to: SEND_TO_EMAIL,
      reply_to: email,
      subject: subjectLine,
      html: `
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Loan Type:</strong> ${loanType || "-"}</p>
        <p><strong>Message:</strong></p>
        <p>${(message || "-").replace(/\n/g, "<br>")}</p>
        <p>Submitted from page: <strong>${sourcePage || "Unknown"}</strong></p>
      `,
    });

    if (error) {
      console.error("Resend send error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to send email" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// Simple health route (optional)
app.get("/", (req, res) => {
  res.send("Easy Way email backend running");
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
