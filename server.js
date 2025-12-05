// server.js
/**
 * Easy Way Loan - backend
 * - Express server that accepts contact/application form submissions
 * - Sends email via Resend HTTP API (resend.emails.send)
 * - Designed for deployment on Render (uses process.env.PORT)
 *
 * Notes:
 * - Keep secrets (RESEND_API_KEY, SEND_TO_EMAIL) out of source code.
 * - Add domain TXT/CNAME records in Hostinger after creating Resend domain verification
 *   for best deliverability, then change the "from" email to use your domain.
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Resend } from "resend";

dotenv.config();

// ---------- Basic sanity checks ----------
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SEND_TO_EMAIL = process.env.SEND_TO_EMAIL;

if (!RESEND_API_KEY) {
  console.error("ERROR: RESEND_API_KEY is not set. Set it in the environment (Render env).");
}
if (!SEND_TO_EMAIL) {
  console.error("ERROR: SEND_TO_EMAIL is not set. Set it (e.g. info@easywayloan.in).");
}

const resend = new Resend(RESEND_API_KEY);

// ---------- Express setup ----------
const app = express();
const port = process.env.PORT || 3000;

// Body parsers
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Allowed origins for CORS (add variants you use)
const allowedOrigins = [
  "http://localhost:5173",        // local dev (Vite default)
  "http://127.0.0.1:5173",
  "https://pink-goldfish-475332.hostingersite.com", // hostinger preview"
  "https://easywayloan.in",       // production (no www)
  "https://www.easywayloan.in"    // production with www
];

// CORS middleware with explicit origin check (safer than allowing all)
app.use(
  cors({
    origin: (origin, callback) => {
      // origin will be undefined for server-to-server requests (curl, Postman) — allow those
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("CORS policy: Origin not allowed"), false);
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,
  })
);

// Explicit preflight handling for our endpoint (optional but explicit)
app.options("/api/send-form", cors());

// ---------- Utility functions ----------
/** Basic HTML-escape to avoid injecting raw HTML in email body */
function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

// ---------- Routes ----------

// Health / readiness ping
app.get("/health", (req, res) => {
  res.json({ status: "ok", env: process.env.NODE_ENV || "development" });
});

// Root route (optional)
app.get("/", (req, res) => {
  res.send("Easy Way Loan backend is running.");
});

/**
 * POST /api/send-form
 * Expected JSON body:
 * { name, email, phone, message, loanType, sourcePage }
 *
 * Reply: { success: true, id: "<resend-id>" } on success
 */
app.post("/api/send-form", async (req, res) => {
  try {
    const { name, email, phone, message, loanType, sourcePage } = req.body || {};

    // Basic validation: require name, email, message
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: name, email, message",
      });
    }

    // Build subject based on source
    let subjectLine;
    switch (sourcePage) {
      case "Application Form":
        subjectLine = `New Loan Application from ${name}`;
        break;
      case "Contact Form":
        subjectLine = `New Contact Request from ${name}`;
        break;
      case "Home Contact":
        subjectLine = `New Enquiry from ${name}`;
        break;
      default:
        subjectLine = `New Enquiry from ${name}`;
    }

    // Sanitize user input before embedding in HTML
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safePhone = escapeHtml(phone || "-");
    const safeLoanType = escapeHtml(loanType || "-");
    const safeMessage = escapeHtml(message).replace(/\n/g, "<br/>");
    const safeSource = escapeHtml(sourcePage || "Website");

    // Compose HTML email
    const html = `
      <h2>Easy Way Loan - New Submission</h2>
      <p><strong>Name:</strong> ${safeName}</p>
      <p><strong>Email:</strong> ${safeEmail}</p>
      <p><strong>Phone:</strong> ${safePhone}</p>
      <p><strong>Loan Type:</strong> ${safeLoanType}</p>
      <p><strong>Message:</strong></p>
      <div>${safeMessage}</div>
      <p><small>Submitted from: ${safeSource}</small></p>
    `;

    // Send using Resend SDK
    const result = await resend.emails.send({
      // Change 'from' to an address on your verified domain (e.g. no-reply@easywayloan.in)
      // after you add the DNS records Resend provides.
      from: "EasyWayLoan <onboarding@resend.dev>",
      to: process.env.SEND_TO_EMAIL_TEST || SEND_TO_EMAIL,
      reply_to: safeEmail,
      subject: subjectLine,
      html,
    });

    // Log result for debugging in Render logs
    console.log("Resend send result:", result);

    return res.json({ success: true, id: result?.id || null });
  } catch (err) {
    console.error("Error in /api/send-form:", err);
    // Provide a safe generic message to the client
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

// ---------- Start server ----------
app.listen(port, () => {
  console.log(`Server listening on port ${port} (env=${process.env.NODE_ENV || "dev"})`);
});
