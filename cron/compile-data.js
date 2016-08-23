import moment from "moment";
import schedule from "./cron-schedule";
import fetchData from "./fetch-data";

console.log("Updating once every", moment.duration(schedule.generationTime).humanize());

fetchData();
setInterval(fetchData, schedule.generationTime);
