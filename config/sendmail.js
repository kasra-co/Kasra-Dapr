import nodemailer from "nodemailer";
import sgTransport from "nodemailer-sendgrid-transport";
import sendToEmails from "./toEmails";
import fs from "fs";

//SENDGRID AUTH DETAILS
const options = {
  auth: {
    api_user: process.env.SENDGRID_USERNAME,
    api_key: process.env.SENDGRID_PASSWORD
  }
}
const mailer = nodemailer.createTransport(sgTransport(options));

export default function(date) {
  const mailOptions = {
    to: sendToEmails.to,
    cc: sendToEmails.cc,
    from: "dapr_reportr@kasra.co",
    subject: "Daily Dapr Report",
    text: `DAPR Report for ${date}`,
    attachments: [{ // utf-8 string as an attachment
      filename: `DAPR_${date}.csv`,
      content: fs.createReadStream(`DAPR_${date}.csv`)
    }]
  };

  mailer.sendMail(mailOptions, function(err, res) {
    if (err) {
      console.log(err)
    }
    console.log(res);
  });
}
