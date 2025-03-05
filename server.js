"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var express = require("express");
var cors = require("cors");
var multer = require("multer");
var path = require("path");
var fs = require("fs");
var nodemailer = require("nodemailer");
require("dotenv").config();
var app = express();
var PORT = process.env.PORT || 3000;
// Create necessary directories
var emailsDir = path.join(__dirname, "saved_emails");
if (!fs.existsSync(emailsDir)) {
    fs.mkdirSync(emailsDir);
    console.log("Saved emails directory created");
}
// Create email logs directory
var emailLogsDir = path.join(__dirname, "email_logs");
if (!fs.existsSync(emailLogsDir)) {
    fs.mkdirSync(emailLogsDir);
    console.log("Email logs directory created");
}
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cors({
    origin: [
        "http://localhost:3000",
        "https://alwaysus.netlify.app",
        "https://e-booth.vercel.app",
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
}));
app.use(express.static("uploads"));
var uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
    console.log("Uploads directory created");
}
// Email validation function
var validateEmail = function (email) {
    // Basic regex for email validation
    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email))
        return false;
    // Check for common typos and issues
    if (email.includes("..") || email.endsWith(".") || email.startsWith("."))
        return false;
    if (email.includes("@@") || email.startsWith("@"))
        return false;
    // Get domain part
    var domain = email.split("@")[1];
    if (!domain || domain.length < 3)
        return false;
    // Check for valid TLD
    var tld = domain.split(".").pop();
    if (!tld || tld.length < 2)
        return false;
    return true;
};
// Create a robust email transporter
var createTransporter = function () {
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
var logEmailAttempt = function (recipientEmail, success, messageId, errorDetails) {
    try {
        var timestamp = new Date().toISOString();
        var logEntry = {
            timestamp: timestamp,
            recipient: recipientEmail,
            success: success,
            messageId: messageId,
            errorDetails: errorDetails ? JSON.stringify(errorDetails) : null,
        };
        // Create filename based on date
        var date = new Date().toISOString().split("T")[0];
        var logFilePath = path.join(emailLogsDir, "email_log_".concat(date, ".json"));
        // Append to existing file or create new one
        var logs = []; // Declare logs as an array of LogEntry type
        if (fs.existsSync(logFilePath)) {
            var fileContent = fs.readFileSync(logFilePath, "utf8");
            logs = JSON.parse(fileContent);
        }
        logs.push(logEntry);
        fs.writeFileSync(logFilePath, JSON.stringify(logs, null, 2));
        console.log("Email attempt logged: ".concat(success ? "SUCCESS" : "FAILED", " - ").concat(recipientEmail));
    }
    catch (err) {
        console.error("Error logging email attempt:", err);
    }
};
// Set up multer for file uploads
var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, "photo-".concat(Date.now()).concat(path.extname(file.originalname)));
    },
});
var upload = multer({ storage: storage });
// Upload endpoint
app.post("/upload", upload.single("image"), function (req, res) {
    if (!req.file) {
        res.status(400).json({ message: "No file uploaded" });
        return; // Ensure function always returns
    }
    console.log("File uploaded:", req.file.filename);
    res.json({ imageUrl: "/".concat(req.file.filename) });
});
// Get images endpoint
app.get("/images", function (req, res) {
    fs.readdir(uploadDir, function (err, files) {
        if (err) {
            console.error("Error reading uploads directory:", err);
            res.status(500).json({ message: "Error reading uploads" });
            return; // Ensure function always returns
        }
        res.json(files.map(function (file) { return ({ url: "/".concat(file) }); }));
    });
});
// Send contact message endpoint
app.post("/send-message", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, name, email, message, logDir, logRequest, transporter_1, formattedFrom, mailOptions_1, sendWithRetry_1, info, logSuccess, error_1, logError, failedEmail;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = req.body, name = _a.name, email = _a.email, message = _a.message;
                if (!name || !email || !message) {
                    res.status(400).json({ message: "All fields are required" });
                    return [2 /*return*/];
                }
                console.log("Incoming message:", { name: name, email: email, message: message });
                logDir = path.join(__dirname, "email_logs");
                if (!fs.existsSync(logDir)) {
                    fs.mkdirSync(logDir);
                }
                logRequest = {
                    timestamp: new Date().toISOString(),
                    sender: email,
                    name: name,
                    messagePreview: message.substring(0, 50) + (message.length > 50 ? "..." : ""),
                };
                fs.writeFileSync(path.join(logDir, "request_".concat(Date.now(), ".json")), JSON.stringify(logRequest, null, 2));
                _b.label = 1;
            case 1:
                _b.trys.push([1, 4, , 5]);
                console.log("Testing email credentials...");
                console.log("Using email:", process.env.EMAIL);
                console.log("Password length:", process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 0);
                transporter_1 = nodemailer.createTransport({
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
                return [4 /*yield*/, transporter_1.verify()];
            case 2:
                _b.sent();
                console.log("Email server is ready");
                formattedFrom = name ? "\"".concat(name, "\" <").concat(email, ">") : email;
                mailOptions_1 = {
                    from: formattedFrom,
                    to: process.env.EMAIL,
                    subject: "New Message from ".concat(name),
                    text: "Email: ".concat(email, "\n\nMessage:\n").concat(message),
                    replyTo: email,
                };
                sendWithRetry_1 = function () {
                    var args_1 = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        args_1[_i] = arguments[_i];
                    }
                    return __awaiter(void 0, __spreadArray([], args_1, true), void 0, function (attempts, delay) {
                        var error_2;
                        if (attempts === void 0) { attempts = 3; }
                        if (delay === void 0) { delay = 1000; }
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 4]);
                                    return [4 /*yield*/, transporter_1.sendMail(mailOptions_1)];
                                case 1: return [2 /*return*/, _a.sent()];
                                case 2:
                                    error_2 = _a.sent();
                                    if (attempts <= 1)
                                        throw error_2;
                                    console.log("Email send failed, retrying... (".concat(attempts - 1, " attempts left)"));
                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, delay); })];
                                case 3:
                                    _a.sent();
                                    return [2 /*return*/, sendWithRetry_1(attempts - 1, delay * 1.5)];
                                case 4: return [2 /*return*/];
                            }
                        });
                    });
                };
                return [4 /*yield*/, sendWithRetry_1()];
            case 3:
                info = _b.sent();
                console.log("Email sent:", info.response);
                logSuccess = {
                    timestamp: new Date().toISOString(),
                    sender: email,
                    status: "success",
                    messageId: info.messageId,
                    response: info.response,
                };
                fs.writeFileSync(path.join(logDir, "success_".concat(Date.now(), ".json")), JSON.stringify(logSuccess, null, 2));
                res.status(200).json({ message: "Email sent successfully" });
                return [3 /*break*/, 5];
            case 4:
                error_1 = _b.sent();
                console.error("Error sending email:", error_1);
                logError = {
                    timestamp: new Date().toISOString(),
                    sender: email,
                    status: "error",
                    errorCode: error_1.code || "unknown",
                    errorMessage: error_1.message,
                    stack: error_1.stack,
                };
                fs.writeFileSync(path.join(logDir, "error_".concat(Date.now(), ".json")), JSON.stringify(logError, null, 2));
                failedEmail = {
                    timestamp: new Date().toISOString(),
                    name: name,
                    email: email,
                    message: message,
                };
                fs.writeFileSync(path.join(__dirname, "saved_emails", "failed_".concat(Date.now(), ".json")), JSON.stringify(failedEmail, null, 2));
                res.status(500).json({
                    message: "Failed to send email. Your message has been saved and we'll try to process it later.",
                    error: (error_1 === null || error_1 === void 0 ? void 0 : error_1.message) || "Unknown error",
                });
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); });
// Send photo strip endpoint
app.post("/send-photo-strip", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, recipientEmail, imageData, transporter, imageContent, parts, mailOptions, info, error_3, errorDetails, errorMessage, statusCode;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = req.body, recipientEmail = _a.recipientEmail, imageData = _a.imageData;
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
                    return [2 /*return*/];
                }
                if (!validateEmail(recipientEmail)) {
                    res.status(400).json({
                        success: false,
                        message: "Invalid email format",
                    });
                    return [2 /*return*/];
                }
                _b.label = 1;
            case 1:
                _b.trys.push([1, 5, , 6]);
                transporter = createTransporter();
                // Verify connection
                return [4 /*yield*/, transporter.verify()];
            case 2:
                // Verify connection
                _b.sent();
                console.log("Email transporter verified successfully");
                imageContent = void 0;
                try {
                    parts = imageData.split("base64,");
                    if (parts.length !== 2) {
                        throw new Error("Invalid image data format");
                    }
                    imageContent = parts[1];
                }
                catch (error) {
                    console.error("Error processing image data:", error);
                    res.status(400).json({
                        success: false,
                        message: "Invalid image data format",
                    });
                    return [2 /*return*/];
                }
                mailOptions = {
                    from: "\"E-Booth\" <".concat(process.env.EMAIL, ">"), // Friendly sender name
                    to: recipientEmail,
                    subject: "Your E-Booth Photo Strip is Ready!",
                    text: "Your photo strip is here! Relive the fun and share your memories!",
                    html: "\n          <div style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background: #f9f9f9; border-radius: 10px;\">\n            <h1 style=\"color: #222; text-align: center; font-size: 24px; margin-bottom: 10px;\">Your E-Booth Photo Strip is Ready! \uD83C\uDF89</h1>\n            <p style=\"text-align: center; font-size: 16px; color: #555;\">\n              Relive the fun and share your favorite moments!\n            </p>\n            <div style=\"text-align: center; margin: 20px 0;\">\n              <img src=\"cid:photostrip\" alt=\"Photo Strip\" \n                style=\"max-width: 100%; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.15);\" />\n            </div>\n            <p style=\"font-size: 12px; text-align: center; color: #888; margin-top: 30px;\">\n              \u00A9 2025 E-Booth. All Rights Reserved.  \n            </p>\n          </div>\n        ",
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
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 300); })];
            case 3:
                // Add a delay to prevent rate limiting
                _b.sent();
                return [4 /*yield*/, transporter.sendMail(mailOptions)];
            case 4:
                info = _b.sent();
                console.log("Email sent successfully:", info.messageId);
                // Log successful email
                logEmailAttempt(recipientEmail, true, info.messageId);
                res.status(200).json({
                    success: true,
                    message: "Photo strip sent successfully!",
                    messageId: info.messageId,
                });
                return [3 /*break*/, 6];
            case 5:
                error_3 = _b.sent();
                console.error("Email sending error:", error_3);
                errorDetails = null;
                if (error_3 instanceof Error) {
                    errorDetails = {
                        code: error_3.code || "unknown",
                        message: error_3.message,
                    };
                }
                // Log failed email
                logEmailAttempt(recipientEmail, false, null, errorDetails);
                errorMessage = "Failed to send email";
                statusCode = 500;
                if ((error_3 === null || error_3 === void 0 ? void 0 : error_3.code) === "EENVELOPE") {
                    errorMessage = "Invalid recipient email address";
                    statusCode = 400;
                }
                else if ((error_3 === null || error_3 === void 0 ? void 0 : error_3.code) === "ETIMEDOUT") {
                    errorMessage = "Connection to email server timed out";
                }
                else if ((error_3 === null || error_3 === void 0 ? void 0 : error_3.code) === "EAUTH") {
                    errorMessage = "Email authentication failed. Check your credentials.";
                }
                res.status(statusCode).json({
                    success: false,
                    message: errorMessage,
                    error: errorDetails,
                });
                return [3 /*break*/, 6];
            case 6: return [2 /*return*/];
        }
    });
}); });
// Saved emails endpoint
app.get("/saved-emails", function (req, res) {
    fs.readdir(emailsDir, function (err, files) {
        if (err) {
            return res.status(500).json({ message: "Error reading saved emails" });
        }
        var emails = files
            .filter(function (file) { return file.endsWith(".json"); })
            .map(function (file) {
            var data = JSON.parse(fs.readFileSync(path.join(emailsDir, file), "utf-8"));
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
app.get("/email-stats", function (req, res) {
    var adminKey = req.query.key;
    if (adminKey !== "picapica-admin-key") {
        res.status(401).json({ message: "Unauthorized access" });
        return;
    }
    try {
        var files = fs.readdirSync(emailLogsDir);
        var totalAttempts_1 = 0;
        var successfulDeliveries_1 = 0;
        var failedDeliveries_1 = 0;
        var domainStats_1 = {};
        files.forEach(function (file) {
            if (file.endsWith(".json")) {
                try {
                    var content = fs.readFileSync(path.join(emailLogsDir, file), "utf8");
                    var logs = JSON.parse(content);
                    logs.forEach(function (log) {
                        totalAttempts_1++;
                        if (log.success) {
                            successfulDeliveries_1++;
                        }
                        else {
                            failedDeliveries_1++;
                        }
                        // Track domain-specific stats
                        try {
                            var domain = log.recipient.split("@")[1];
                            if (domain) {
                                if (!domainStats_1[domain]) {
                                    domainStats_1[domain] = { attempts: 0, success: 0, failure: 0 };
                                }
                                domainStats_1[domain].attempts++;
                                if (log.success) {
                                    domainStats_1[domain].success++;
                                }
                                else {
                                    domainStats_1[domain].failure++;
                                }
                            }
                        }
                        catch (e) {
                            console.error("Error processing domain stats:", e);
                        }
                    });
                }
                catch (error) {
                    console.error("Error reading log file ".concat(file, ":"), error);
                }
            }
        });
        // Calculate success rates for each domain
        Object.keys(domainStats_1).forEach(function (domain) {
            var stats = domainStats_1[domain];
            stats.successRate =
                stats.attempts > 0
                    ? ((stats.success / stats.attempts) * 100).toFixed(2) + "%"
                    : "0%";
        });
        res.json({
            totalAttempts: totalAttempts_1,
            successfulDeliveries: successfulDeliveries_1,
            failedDeliveries: failedDeliveries_1,
            successRate: totalAttempts_1 > 0
                ? ((successfulDeliveries_1 / totalAttempts_1) * 100).toFixed(2) + "%"
                : "0%",
            domainStats: domainStats_1,
        });
    }
    catch (error) {
        res.status(500).json({
            message: "Error retrieving stats",
            error: error.message,
        });
    }
});
// Root endpoint
app.get("/", function (req, res) {
    res.send("E-Booth Backend is running");
});
// Start the server
app.listen(PORT, function () {
    console.log("Server running on http://localhost:".concat(PORT));
});
