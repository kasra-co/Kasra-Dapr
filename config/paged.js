const request = require("superagent");
require("superagent-retry")(request);

module.exports = function requestPage(url, receive, complete, reject) {
  if (!url) return complete();

  request.get(url)
  .retry(3)
  .end((error, res) => {
    if (error) {
      console.error("Failed to retrieve next page", url);
      return reject(error);
    }
    const response = {data: JSON.parse(res.text, null, 4)};
    receive(response);
    setTimeout(() => {
      requestPage((res.body.paging || {}).next, receive, complete, reject);
    }, 1000);
  });
}
