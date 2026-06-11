// SendGrid Node.js onboarding sample
// https://github.com/sendgrid/sendgrid-nodejs
import sgMail from "@sendgrid/mail";

const apiKey = process.env.SENDGRID_API_KEY;
if (!apiKey) {
  console.error("Missing SENDGRID_API_KEY");
  process.exit(1);
}

sgMail.setApiKey(apiKey);

const to = process.env.SENDGRID_TEST_TO ?? "kevinbuluma9@gmail.com";
const from = process.env.SENDGRID_FROM_EMAIL ?? "kevinbuluma9@gmail.com";

const msg = {
  to,
  from,
  subject: "Sending with SendGrid is Fun",
  text: "and easy to do anywhere, even with Node.js",
  html: "<strong>and easy to do anywhere, even with Node.js</strong>",
};

try {
  await sgMail.send(msg);
  console.log("Email sent");
} catch (error) {
  console.error(error?.response?.body ?? error);
  process.exit(1);
}
