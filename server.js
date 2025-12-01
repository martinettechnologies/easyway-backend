// server.js
import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();
const app = express();

// parse JSON + urlencoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS settings
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://darkblue-fly-926171.hostingersite.com", // live site
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

// Email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: process.env.SMTP_TLS_REJECT !== "false",
  },
});

// Verify transporter
transporter.verify((err, success) => {
  if (err) {
    console.error("Email transporter verification failed:", err);
  } else {
    console.log("Email transporter ready");
  }
});

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

  const mailOptions = {
    from: `"Easy Way Loans" <${process.env.SMTP_USER}>`,
    to: process.env.SEND_TO_EMAIL,
    replyTo: email,
    subject: subjectLine,
    text: `
Name: ${name}
Email: ${email}
Phone: ${phone}
Loan Type: ${loanType}
Message: ${message}
Source Page: ${sourcePage}
`,
    html: `
      <h2>${subjectLine}</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Loan Type:</strong> ${loanType || "-"}</p>
      <p><strong>Message:</strong><br/>${(message || "-").replace(/\n/g, "<br/>")}</p>
      <hr/>
      <p>Submitted from page: <strong>${sourcePage || "Unknown"}</strong></p>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.messageId);
    res.json({ success: true });
  } catch (err) {
    console.error("Email error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Run server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log("Email server running on port", PORT);
});
