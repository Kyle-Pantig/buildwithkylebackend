/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Create necessary directories
const emailsDir = path.join(__dirname, "saved_emails");
if (!fs.existsSync(emailsDir)) {
  fs.mkdirSync(emailsDir);
  console.log("Saved emails directory created");
}

// Create email logs directory
const emailLogsDir = path.join(__dirname, "email_logs");
if (!fs.existsSync(emailLogsDir)) {
  fs.mkdirSync(emailLogsDir);
  console.log("Email logs directory created");
}

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://alwaysus.netlify.app",
      "https://e-booth.vercel.app",
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.static("uploads"));

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
  console.log("Uploads directory created");
}

// Email validation function
const validateEmail = (email: string) => {
  // Basic regex for email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return false;

  // Check for common typos and issues
  if (email.includes("..") || email.endsWith(".") || email.startsWith("."))
    return false;
  if (email.includes("@@") || email.startsWith("@")) return false;

  // Get domain part
  const domain = email.split("@")[1];
  if (!domain || domain.length < 3) return false;

  // Check for valid TLD
  const tld = domain.split(".").pop();
  if (!tld || tld.length < 2) return false;

  return true;
};

// Create a robust email transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
    // Add these options for better reliability
    pool: true, // Use connection pool
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 5, // Limit to 5 messages per second
    // Set timeout values
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
    socketTimeout: 30000,
  });
};

// Function to log email attempts
const logEmailAttempt = (
  recipientEmail: string,
  success: boolean,
  messageId: string | null,
  errorDetails?: { code?: string; message: string; type?: string } | null
) => {
  try {
    const timestamp = new Date().toISOString();

    type LogEntry = {
      timestamp: string;
      recipient: string;
      success: boolean;
      messageId: string | null;
      errorDetails: string | null;
    };
    const logEntry: LogEntry = {
      timestamp,
      recipient: recipientEmail,
      success,
      messageId,
      errorDetails: errorDetails ? JSON.stringify(errorDetails) : null,
    };

    // Create filename based on date
    const date = new Date().toISOString().split("T")[0];
    const logFilePath = path.join(emailLogsDir, `email_log_${date}.json`);

    // Append to existing file or create new one
    let logs: LogEntry[] = []; // Declare logs as an array of LogEntry type
    if (fs.existsSync(logFilePath)) {
      const fileContent = fs.readFileSync(logFilePath, "utf8");
      logs = JSON.parse(fileContent);
    }

    logs.push(logEntry);

    fs.writeFileSync(logFilePath, JSON.stringify(logs, null, 2));

    console.log(
      `Email attempt logged: ${
        success ? "SUCCESS" : "FAILED"
      } - ${recipientEmail}`
    );
  } catch (err) {
    console.error("Error logging email attempt:", err);
  }
};

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (
    req: any,
    file: any,
    cb: (arg0: null, arg1: string) => void
  ) => {
    cb(null, uploadDir);
  },
  filename: (
    req: any,
    file: { originalname: string },
    cb: (arg0: null, arg1: string) => void
  ) => {
    cb(null, `photo-${Date.now()}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage });

// Upload endpoint
app.post(
  "/upload",
  upload.single("image"),
  (req: Request, res: Response): void => {
    if (!req.file) {
      res.status(400).json({ message: "No file uploaded" });
      return; // Ensure function always returns
    }

    console.log("File uploaded:", req.file.filename);
    res.json({ imageUrl: `/${req.file.filename}` });
  }
);

// Get images endpoint

app.get("/images", (req: Request, res: Response): void => {
  fs.readdir(uploadDir, (err, files) => {
    if (err) {
      console.error("Error reading uploads directory:", err);
      res.status(500).json({ message: "Error reading uploads" });
      return; // Ensure function always returns
    }

    res.json(files.map((file) => ({ url: `/${file}` })));
  });
});

// Send contact message endpoint

app.post(
  "/send-message",
  async (req: Request, res: Response): Promise<void> => {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      res.status(400).json({ message: "All fields are required" });
      return;
    }

    console.log("Incoming message:", { name, email, message });

    const logDir = path.join(__dirname, "email_logs");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir);
    }

    const logRequest = {
      timestamp: new Date().toISOString(),
      sender: email,
      name,
      messagePreview:
        message.substring(0, 50) + (message.length > 50 ? "..." : ""),
    };

    fs.writeFileSync(
      path.join(logDir, `request_${Date.now()}.json`),
      JSON.stringify(logRequest, null, 2)
    );

    try {
      console.log("Testing email credentials...");
      console.log("Using email:", process.env.EMAIL);
      console.log(
        "Password length:",
        process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 0
      );

      const transporter = nodemailer.createTransport({
        service: "gmail",
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
          user: process.env.EMAIL,
          pass: process.env.EMAIL_PASS,
        },
        tls: {
          rejectUnauthorized: false,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        debug: true,
      });

      await transporter.verify();
      console.log("Email server is ready");

      const formattedFrom = name ? `"${name}" <${email}>` : email;

      const mailOptions = {
        from: formattedFrom,
        to: process.env.EMAIL,
        subject: `New Message from ${name}`,
        text: `Email: ${email}\n\nMessage:\n${message}`,
        replyTo: email,
      };

      const sendWithRetry = async (attempts = 3, delay = 1000) => {
        try {
          return await transporter.sendMail(mailOptions);
        } catch (error) {
          if (attempts <= 1) throw error;
          console.log(
            `Email send failed, retrying... (${attempts - 1} attempts left)`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          return sendWithRetry(attempts - 1, delay * 1.5);
        }
      };

      const info = await sendWithRetry();
      console.log("Email sent:", info.response);

      const logSuccess = {
        timestamp: new Date().toISOString(),
        sender: email,
        status: "success",
        messageId: info.messageId,
        response: info.response,
      };

      fs.writeFileSync(
        path.join(logDir, `success_${Date.now()}.json`),
        JSON.stringify(logSuccess, null, 2)
      );

      res.status(200).json({ message: "Email sent successfully" });
    } catch (error) {
      console.error("Error sending email:", error);

      const logError = {
        timestamp: new Date().toISOString(),
        sender: email,
        status: "error",
        errorCode: (error as any).code || "unknown",
        errorMessage: (error as Error).message,
        stack: (error as Error).stack,
      };

      fs.writeFileSync(
        path.join(logDir, `error_${Date.now()}.json`),
        JSON.stringify(logError, null, 2)
      );

      const failedEmail = {
        timestamp: new Date().toISOString(),
        name,
        email,
        message,
      };

      fs.writeFileSync(
        path.join(__dirname, "saved_emails", `failed_${Date.now()}.json`),
        JSON.stringify(failedEmail, null, 2)
      );

      res.status(500).json({
        message:
          "Failed to send email. Your message has been saved and we'll try to process it later.",
        error: (error as any)?.message || "Unknown error",
      });
    }
  }
);

// Send photo strip endpoint
app.post(
  "/send-photo-strip",
  async (req: Request, res: Response): Promise<void> => {
    const { recipientEmail, imageData } = req.body;
    console.log("Received email:", recipientEmail);
    console.log("Received imageData length:", imageData.length); // Check size of data

    console.log("Attempting to send photo strip to:", recipientEmail);
    console.log("Environment variables check:", {
      hasEmail: !!process.env.EMAIL,
      hasEmailPass: !!process.env.EMAIL_PASS,
    });

    // Email validation
    if (!recipientEmail || !imageData) {
      res.status(400).json({
        success: false,
        message: "Missing email or image data",
      });
      return;
    }

    if (!validateEmail(recipientEmail)) {
      res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
      return;
    }

    try {
      // Create transporter with improved configuration
      const transporter = createTransporter();

      // Verify connection
      await transporter.verify();
      console.log("Email transporter verified successfully");

      // Better handling of the image data
      let imageContent: string;
      try {
        const parts = imageData.split("base64,");
        if (parts.length !== 2) {
          throw new Error("Invalid image data format");
        }
        imageContent = parts[1];
      } catch (error) {
        console.error("Error processing image data:", error);
        res.status(400).json({
          success: false,
          message: "Invalid image data format",
        });
        return;
      }

      const mailOptions = {
        from: `"E-Booth" <${process.env.EMAIL}>`, // Friendly sender name
        to: recipientEmail,
        subject: "Your E-Booth Photo Strip is Ready!",
        text: "Your photo strip is here! Relive the fun and share your memories!",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background: #f9f9f9; border-radius: 10px;">
            <h1 style="color: #222; text-align: center; font-size: 24px; margin-bottom: 10px;">Your E-Booth Photo Strip is Ready! 🎉</h1>
            <p style="text-align: center; font-size: 16px; color: #555;">
              Relive the fun and share your favorite moments!
            </p>
            <div style="text-align: center; margin: 20px 0;">
              <img src="cid:photostrip" alt="Photo Strip" 
                style="max-width: 100%; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.15);" />
            </div>
            <p style="font-size: 12px; text-align: center; color: #888; margin-top: 30px;">
              © 2025 E-Booth. All Rights Reserved.  
            </p>
          </div>
        `,
        attachments: [
          {
            filename: "e-photo-strip.png",
            content: imageContent,
            encoding: "base64",
            cid: "photostrip", // Referenced in the HTML above
          },
        ],
      };

      // Add a delay to prevent rate limiting
      await new Promise((resolve) => setTimeout(resolve, 300));

      const info = await transporter.sendMail(mailOptions);
      console.log("Email sent successfully:", info.messageId);

      // Log successful email
      logEmailAttempt(recipientEmail, true, info.messageId);

      res.status(200).json({
        success: true,
        message: "Photo strip sent successfully!",
        messageId: info.messageId,
      });
    } catch (error: unknown) {
      console.error("Email sending error:", error);

      let errorDetails: { code?: string; message: string } | null = null;

      if (error instanceof Error) {
        errorDetails = {
          code: (error as any).code || "unknown",
          message: error.message,
        };
      }

      // Log failed email
      logEmailAttempt(recipientEmail, false, null, errorDetails);

      // More descriptive error responses
      let errorMessage = "Failed to send email";
      let statusCode = 500;

      if ((error as any)?.code === "EENVELOPE") {
        errorMessage = "Invalid recipient email address";
        statusCode = 400;
      } else if ((error as any)?.code === "ETIMEDOUT") {
        errorMessage = "Connection to email server timed out";
      } else if ((error as any)?.code === "EAUTH") {
        errorMessage = "Email authentication failed. Check your credentials.";
      }

      res.status(statusCode).json({
        success: false,
        message: errorMessage,
        error: errorDetails,
      });
    }
  }
);

// Saved emails endpoint
app.get("/saved-emails", (req: Request, res: Response): void => {
  fs.readdir(emailsDir, (err, files) => {
    if (err) {
      return res.status(500).json({ message: "Error reading saved emails" });
    }

    const emails = files
      .filter((file) => file.endsWith(".json"))
      .map((file) => {
        const data = JSON.parse(
          fs.readFileSync(path.join(emailsDir, file), "utf-8")
        );
        return {
          filename: file,
          to: data.to,
          date: data.date,
        };
      });

    res.json(emails);
  });
});

// Email stats endpoint
app.get("/email-stats", (req: Request, res: Response): void => {
  const adminKey = req.query.key as string;

  if (adminKey !== "picapica-admin-key") {
    res.status(401).json({ message: "Unauthorized access" });
    return;
  }

  try {
    const files = fs.readdirSync(emailLogsDir);
    let totalAttempts = 0;
    let successfulDeliveries = 0;
    let failedDeliveries = 0;
    const domainStats: Record<
      string,
      {
        attempts: number;
        success: number;
        failure: number;
        successRate?: string;
      }
    > = {};

    files.forEach((file) => {
      if (file.endsWith(".json")) {
        try {
          const content = fs.readFileSync(
            path.join(emailLogsDir, file),
            "utf8"
          );
          const logs: { success: boolean; recipient: string }[] =
            JSON.parse(content);

          logs.forEach((log) => {
            totalAttempts++;

            if (log.success) {
              successfulDeliveries++;
            } else {
              failedDeliveries++;
            }

            // Track domain-specific stats
            try {
              const domain = log.recipient.split("@")[1];
              if (domain) {
                if (!domainStats[domain]) {
                  domainStats[domain] = { attempts: 0, success: 0, failure: 0 };
                }

                domainStats[domain].attempts++;
                if (log.success) {
                  domainStats[domain].success++;
                } else {
                  domainStats[domain].failure++;
                }
              }
            } catch (e) {
              console.error("Error processing domain stats:", e);
            }
          });
        } catch (error) {
          console.error(`Error reading log file ${file}:`, error);
        }
      }
    });

    // Calculate success rates for each domain
    Object.keys(domainStats).forEach((domain) => {
      const stats = domainStats[domain];
      stats.successRate =
        stats.attempts > 0
          ? ((stats.success / stats.attempts) * 100).toFixed(2) + "%"
          : "0%";
    });

    res.json({
      totalAttempts,
      successfulDeliveries,
      failedDeliveries,
      successRate:
        totalAttempts > 0
          ? ((successfulDeliveries / totalAttempts) * 100).toFixed(2) + "%"
          : "0%",
      domainStats,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error retrieving stats",
      error: (error as Error).message,
    });
  }
});

// Root endpoint
app.get("/", (req: any, res: { send: (arg0: string) => void }) => {
  res.send("E-Booth Backend is running");
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
