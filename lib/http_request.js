/* http_request.js
 * Make an external http request while processing one.
 * Promise compatible. Example usage: const http_get = Promise.promisify(require('./lib/http_request.js').http_get);
 */

// TODO: https support.

const http = require('http');
const URL = require('url');

var self = module.exports = {

    // %%% TODO: Convert .get to .request (same as post)
    http_get: function(url, callback) {

        http.get(url, (res) => {
            var data = '';
         
            // A chunk of data has been recieved.
            res.on('data', (chunk) => {
                data += chunk;
            });
         
            // The whole response has been received.
            res.on('end', () => {
                var json = JSON.parse(data);
                callback(null, json);
            });
         
        }).on("error", (err) => {
            console.log("Error: " + err.message);
            callback(err.message, null);
        });
    },

    http_post: function(url, headers, body, callback) {

        var urlObj = URL.parse(url);

        // An object of options to indicate where to post to
        var post_options = {
          host: urlObj.hostname,
          port: urlObj.port,
          path: urlObj.path,
          method: 'POST',
          headers: JSON.stringify(headers)
        };

        var data = '';

        // Set up the request
        var post_req = http.request(post_options, function(res) {
            res.setEncoding('utf8');
            res.on('data', function (chunk) {
                data += chunk;
            });

            // The whole response has been received.
            res.on('end', function() {
                var json = JSON.parse(data);
                callback(null, json);
            });
            
            res.on('error', function(err) {
                console.log("Error: " + err.message);
                callback(err.message, null);
            });
        });

        // post the data
        post_req.write(body);
        post_req.end();
    }
}