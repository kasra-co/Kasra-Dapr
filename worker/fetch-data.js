import axios from "axios";
import moment from "moment";
import json2csv from "json2csv";
import request from "requestretry";
import fs from "fs";
import { map, find, get } from "lodash";
import google from "googleapis";
import googleAnalyticData from "../kasra-website-ga.json";
import { mapSeries, waterfall, mapLimit } from "async";
import requestPage from "../config/paged";
import sendMail from "../config/sendmail";
import sendErrorMail from "../config/sendErrorMail";
import CtrModel from "../model/ctr";
import DaprModel from "../model/dapr";
import mongoose from "mongoose";
import mongoConnectionString from "../util/mongo-connection-string";

const GA_VIEW_ID = process.env.GA_VIEW_ID;

//CSV FIELDS
const fields = ["count", "absUrl", "title",
  "author.displayName", "publishYear",
  "publishTime", "publishTZone", "mood", "share.share_count",
  "ga:pageviews", "inline_link_click_ctr", "adId"
];
const fieldNames = ["#", "Url", "Title", "Author",
  "Published Date", "Published Time", "TimeZone",
  "Emotions", "FB Shares", "Total Page Views", "FB CTR", "FB Ad ID"
];

const m = moment().utcOffset(3);
m.subtract(7, "d").set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
m.toISOString();
const gt = m.format();
const ltfmt = moment().utcOffset(3);
ltfmt.subtract(7, "d").set({ hour: 23, minute: 59, second: 59, millisecond: 0 });
ltfmt.toISOString();
const lt = ltfmt.format();
const date = moment(gt).utcOffset(3).format("YYYY-MM-DD");
console.log(gt, lt, moment().format());
export default function() {
  mongoose.connect(mongoConnectionString);
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
    console.log(res.data.length);
    pullStunts(res.data);
  }).catch(error => {
    console.log(error, "error");
  });
}

function returnNextPageResults(res, slug, cb) {
  if (!res) {
    cb(null);
  }
  return new Promise(resolve => {
    let insights = res.data.data;
    let nextData;
    requestPage((res.data.paging || {}).next, nextInsights => {
      nextData = nextInsights;
      return insights.concat(nextInsights.data);
    }, () => {
      setTimeout(() => {
        const findInsight = returnInsight(insights, slug);
        if (!findInsight) {
          return returnNextPageResults(nextData, slug, cb);
        } else {
          cb(findInsight);
        }
      }, 1000);
    }, error => {
      console.log("Unhandled error while retrieving report", error);
      callback(null);
    });
  })
}

function returnInsight(insights, slug) {
  return find(insights, function(o) {
    return o.creative.object_story_spec ? o.creative.object_story_spec.link_data.name === slug : false;
  });
}

let analytics;
let jwtClient = new google.auth.JWT(
  googleAnalyticData.client_email, null, googleAnalyticData.private_key, ["https://www.googleapis.com/auth/analytics.readonly"], null);
jwtClient.authorize(function(err, tokens) {
  if (err) {
    console.log(err);
    return;
  }
  analytics = google.analytics("v3");
});

function queryData(analytics, articleData, callback) {
  analytics.data.ga.get({
    "auth": jwtClient,
    "ids": GA_VIEW_ID,
    "metrics": "ga:pageviews",
    "dimensions": "ga:pagePath",
    "start-date": "7daysAgo",
    "end-date": "today",
    "max-results": 10,
    "filters": `ga:pagePath==/${articleData.slug};ga:hostname==kasra.co`,
  }, function(err, response) {
    if (err) {
      console.log(err);
      sendErrorMail(date, err);
      return;
    }
    console.log(JSON.stringify(response.totalsForAllResults["ga:pageviews"], null, 4), articleData.slug);
    callback(response);
  });
}

function pullStunts(articleData) {
  waterfall([
    function(callback) {
      let count = 0;
      //GET FACEBOOK SHARES COUNT
      mapSeries(articleData, function(result, cb) {
        request({
            url: `https://graph.facebook.com/v2.7/?id=https://kasra.co/${encodeURIComponent(result.slug)}`,
            json: true,
            qs: {
              access_token: process.env.ADS_INSIGHT_TOKEN
            },
            maxAttempts: 5,
            retryDelay: 1800, // (default) wait for 30mins before trying again
            retryStrategy: request.RetryStrategies.HTTPOrNetworkError, // (default) retry on 5xx or network errors
          })
          .then(function(response) {
            result.absUrl = "https://kasra.co/" + result.shortUrl;
            result.publishYear = moment(result.publishDate).format("YYYY-MM-DD");
            result.publishTZone = "AST";
            result.publishTime = moment(result.publishDate).utcOffset(0).format("HH:mm");
            result.count = ++count;
            const populate = Object.assign(result, response.body);
            cb(null, result);
          });
      }, function(err, result) {
        console.log("Done getting shares for articles");
        if (err) {
          console.log("error getting shares for articles", err);
        }
        callback(null, result);
      });
    },
    function(fbsharesResult, callback) {
      //GET ARTICLES PAGE VIEWS
      let genObj = genFunc();

      let val = genObj.next();

      let interval = setInterval(() => {
        val = genObj.next();

        if (val.done) {
          clearInterval(interval);
        } else {
          console.log(val);
        }
      }, 30000);

      function* genFunc() {
        yield mapSeries(articleData, function(result, cb) {
          queryData(analytics, result, function(gaResponse) {
            const populate = Object.assign(result, get(gaResponse, "totalsForAllResults"));
            cb(null, populate);
          });
        }, function(err, result) {
          if (err) {
            console.log(err, "error getting data from GA");
          }
          console.log("Data done for GA");
          callback(null, fbsharesResult);
        });
      }
    },
    function(data, callback) {
      //GET ARTICLES CLICK THROUGH RATE
      axios.get(`https://graph.facebook.com/v2.7/act_1083321921708491/ads?fields=["creative.fields(id,object_story_spec.fields(link_data.fields(name,link)))"]&limit=500`, {
        params: {
          "access_token": process.env.ADS_INSIGHT_TOKEN
        }
      }).then((facebookCreative) => {
        mapSeries(articleData, function(result, cb) {
          returnNextPageResults(facebookCreative, result.title, function(response) {
            console.log(result.title);
            if (response && response.id) {
              axios.get(`https://graph.facebook.com/v2.7/${get(response, "id")}/insights?fields=inline_link_click_ctr`, {
                params: {
                  "access_token": process.env.ADS_INSIGHT_TOKEN
                }
              }).then(adResponse => {
                try {
                  let ctr = new CtrModel();
                  let dapr = new DaprModel(result);
                  ctr.title = result.title;
                  ctr.slug = result.slug;
                  ctr.inlineCtr = Object.assign(get(adResponse, "data.data[0]") || "", { ad_id: response.id });
                  ctr.save();
                  dapr.author = result.author.displayName;
                  dapr.fbShares = result.share.share_count;
                  dapr.gaViews = get(result, `["ga:pageviews"]`);
                  dapr.inlineCtr = get(adResponse, "data.data[0]");
                  dapr.save();
                } catch (error) {
                  console.error(error, "sending to db");
                }
                const populate = Object.assign(result, get(adResponse, "data.data[0]"), { adId: response.id });
                cb(null, populate);
              }).catch(error => {
                cb(null, error);
              })
            } else {
              const populate = Object.assign(result, { inline_link_click_ctr: 0 });
              cb(null, populate);
            }
          });
        }, function(err, result) {
          console.log("done getting click ctr");
          callback(null, result);
        })
      }).catch(error => {
        console.log(error);
      });
    }
  ], function(err, result) {
    result.sort(function(a, b) {
      if (a.count < b.count) return -1;
      if (a.count > b.count) return 1;
      return 0;
    });
    const csvConvert = json2csv({ data: result, fields: fields, fieldNames: fieldNames });
    fs.writeFile(`DAPR_${date}.csv`, csvConvert, function(err) {
      if (err) throw err;
      console.log("file saved");
      // sendMail(date);
    });
    // result now equals "done"
  });
}
