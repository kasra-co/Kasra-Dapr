require("babel-polyfill");

import os from "os";
import cluster from "cluster";

import App from "./app";

function startMaster() {
  const workforce = process.env.WEB_CONCURRENCY || os.cpus().length;

  for (var i = 0; i < workforce; i++) {
    setTimeout(() => {
      cluster.fork();
    }, i * 1000);
  }

  cluster.on("exit", (worker) => {
    console.warn(`Worker ${worker.process.pid} died, forking new worker`);
    cluster.fork();
  });
}

function startWorker() {

  const app = App();
  const port = process.env.PORT || 6500;
  app.listen(port);

  console.info(`==> ✅  Server is listening in ${process.env.NODE_ENV || "development"} mode, with worker ${process.pid}`)
  console.info(`==> 🌎  started on port ${port}`, {event: "start", port})

  if (process.send) {
    process.send("online");
  }
}

// Not enough memory on free heroku for fork mode
if (cluster.isMaster && process.env.NODE_ENV !== "development") {
  startMaster();
} else {
  startWorker();
}
