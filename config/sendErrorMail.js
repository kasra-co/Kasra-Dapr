import nodemailer from "nodemailer";
import sgTransport from "nodemailer-sendgrid-transport";
import sendToEmails from "./toEmails";

//SENDGRID AUTH DETAILS
const options = {
  auth: {
    api_user: process.env.SENDGRID_USERNAME,
    api_key: process.env.SENDGRID_PASSWORD
  }
}
const mailer = nodemailer.createTransport(sgTransport(options));

export default function(date, error) {
  const mailOptions = {
    to: sendToEmails.error.to,
    cc: sendToEmails.error.cc,
    from: "dapr_reportr@kasra.co",
    subject: "Error Occured Generating DAPR Report",
    text: `Error generating report on ${date} \nError Message => ${error.errors[0].message}`
  };

  mailer.sendMail(mailOptions, function(err, res) {
    if (err) {
      console.log(err)
    }
    console.log(res);
  });
}
