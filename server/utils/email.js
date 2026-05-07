const nodemailer = require("nodemailer");

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER) {
    console.warn("⚠️  Email credentials not set. Email sending disabled.");
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: Number(process.env.EMAIL_PORT) === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  return transporter;
};

/**
 * Send an email
 * @param {object} options - { to, subject, html, text }
 */
const sendEmail = async ({ to, subject, html, text }) => {
  const t = getTransporter();
  if (!t) {
    console.log(`[Email Skipped] To: ${to}, Subject: ${subject}`);
    return;
  }

  const mailOptions = {
    from: `"RoadSense AI" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
    text,
  };

  const info = await t.sendMail(mailOptions);
  console.log(`[Email Sent] To: ${to}, MessageId: ${info.messageId}`);
  return info;
};

module.exports = { sendEmail };
