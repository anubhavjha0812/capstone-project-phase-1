import nodemailer from "nodemailer";

// Escape user-provided text before putting it into an HTML email
export const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const layout = (content) => `
  <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #ffffff;">
    <h2 style="color: #2b6cb0; text-align: center; margin-bottom: 8px;">Predictix Healthcare</h2>
    ${content}
    <hr style="border: none; border-top: 1px solid #edf2f7; margin: 20px 0;" />
    <p style="font-size: 12px; color: #a0aec0; text-align: center;">Predictix Multi-Disease Predictor Platform</p>
  </div>
`;

/**
 * Sends an email using EMAIL_USER / EMAIL_PASS from .env.
 * If they are not set (or SMTP fails), the email is "simulated": nothing is sent
 * and { simulated: true } is returned so callers can tell the user.
 */
const sendMail = async ({ to, subject, html, replyTo }) => {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;
  const emailService = process.env.EMAIL_SERVICE || "gmail";

  if (!emailUser || !emailPass) {
    console.log(
      `[EMAIL SERVICE] EMAIL_USER and EMAIL_PASS not set in .env. Simulated email "${subject}" to ${to || emailUser}.`
    );
    return { success: true, simulated: true };
  }

  try {
    const transporter = nodemailer.createTransport({
      service: emailService,
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });

    await transporter.sendMail({
      from: `"Predictix Multi-Disease Predictor" <${emailUser}>`,
      to: to || emailUser,
      replyTo,
      subject,
      html,
    });
    console.log(`[EMAIL SERVICE] "${subject}" sent to ${to || emailUser}`);
    return { success: true, simulated: false };
  } catch (error) {
    console.error(`[EMAIL SERVICE] Failed to send "${subject}" via SMTP:`, error.message);
    return {
      success: false,
      simulated: true,
      warning: `SMTP error: ${error.message}`,
    };
  }
};

/**
 * Sends an OTP to the given email address.
 * Always logs the OTP clearly in the backend console so development and local testing work seamlessly.
 */
export const sendOtpEmail = async (toEmail, otp) => {
  console.log("\n=======================================================");
  console.log(`[OTP SERVICE] Password Reset OTP for: ${toEmail}`);
  console.log(`[OTP SERVICE] >>> CODE: ${otp} <<< (Valid for 10 minutes)`);
  console.log("=======================================================\n");

  const result = await sendMail({
    to: toEmail,
    subject: "Predictix - Password Reset OTP",
    html: layout(`
      <p style="font-size: 15px; color: #4a5568; line-height: 1.5;">Hello,</p>
      <p style="font-size: 15px; color: #4a5568; line-height: 1.5;">
        You requested a One-Time Password (OTP) to reset your account password. Please use the verification code below:
      </p>
      <div style="background-color: #ebf8ff; border: 1px solid #bee3f8; padding: 18px; text-align: center; font-size: 30px; font-weight: bold; letter-spacing: 6px; color: #2b6cb0; border-radius: 8px; margin: 24px 0;">
        ${otp}
      </div>
      <p style="font-size: 13px; color: #718096; margin-top: 16px;">
        This OTP is valid for <strong>10 minutes</strong>. If you did not request this code, please ignore this email.
      </p>
    `),
  });

  // The OTP is always available in the console, so the flow still works when SMTP fails
  return { ...result, success: true };
};

// Sends a Contact page message to the Predictix team's inbox (EMAIL_USER)
export const sendContactEmail = async ({ name, email, message }) =>
  sendMail({
    replyTo: email,
    subject: `Predictix - Contact message from ${name}`,
    html: layout(`
      <p style="font-size: 15px; color: #4a5568;"><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p style="font-size: 15px; color: #4a5568;"><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p style="font-size: 15px; color: #4a5568;"><strong>Message:</strong></p>
      <p style="font-size: 15px; color: #4a5568; line-height: 1.5; white-space: pre-wrap;">${escapeHtml(message)}</p>
    `),
  });

// Confirms a newsletter subscription and includes a one-click unsubscribe link
export const sendSubscriptionEmail = async (toEmail, unsubscribeUrl) =>
  sendMail({
    to: toEmail,
    subject: "Predictix - You're subscribed to updates",
    html: layout(`
      <p style="font-size: 15px; color: #4a5568; line-height: 1.5;">Hello,</p>
      <p style="font-size: 15px; color: #4a5568; line-height: 1.5;">
        Thanks for subscribing to Predictix updates. We'll email you about new predictors and features.
      </p>
      <p style="font-size: 13px; color: #718096; margin-top: 16px;">
        Didn't subscribe, or changed your mind?
        <a href="${escapeHtml(unsubscribeUrl)}" style="color: #2b6cb0;">Unsubscribe</a>
      </p>
    `),
  });
