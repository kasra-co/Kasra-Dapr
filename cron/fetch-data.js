import axios from "axios";
import moment from "moment";
import json2csv from "json2csv";
import fs from "fs";
import { map } from "lodash";

const fields = ["shortUrl", "title", "author.displayName", "publishDate", "mood", "share.share_count"];
const fieldNames = ["Short Url", "Title", "Author Name", "Published Date", "Mood Tags", "Shares"];
export default async function() {
  const m = moment().utcOffset(1);
  m.subtract(7, "d").set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
  m.toISOString();
  const gt = m.format();
  const lt = moment().subtract(6, "d").hour(0).minutes(59).seconds(59).milliseconds(0).toISOString();
  console.log(gt, lt)
  axios.get("https://kasra.co/api/v2/articles", {
    params: {
      operations: {
        limit: 100,
        sort: "publishDate"
      },
      conditions: {
        publishDate: { $gte: gt, $lt: lt },
        status: "published"
      }
    }
  }).then(res => {
    console.log(res.data.length)
    // getShares(res.data);
  }).catch(error => {
    console.log(error, "error");
  });
}

let x = [];

function getResults(object) {
  x.push(object);
}

// setTimeout(() => {
//   var result = json2csv({ data: x, fields: fields, fieldNames: fieldNames });
//   fs.writeFile("file.csv", result, function(err) {
//     if (err) throw err;
//     console.log("file saved");
//   });
// }, 10000);

function getGAViews(articleData) {
  
}

function getShares(articleData) {
  map(articleData, result => {
    axios.get(`http://graph.facebook.com/?id=https://kasra.co/${result.shortUrl}`).then(response => {
      getResults(Object.assign(result, response.data));
    }).catch(error => {
      console.log(error);
    });
  });
}
