const parser = require('sax2json');
const request = require('request');

exports.handler = function(event, context, callback) {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    const origin = event.headers.origin || '*';
    callback(null, {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers':
          'Content-Type, X-Requested-With, X-HTTP-Method-Override, Origin, Accept, Authorization',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
      body: '',
    });
    return;
  }

  // Handle GET requests
  if (event.httpMethod === 'GET') {
    const header = event.headers['authorization'] || ''; // get the header
    const token = header.split(/\s+/).pop() || ''; // and the encoded auth token
    const auth = Buffer.from(token, 'base64').toString(); // convert from base64
    const parts = auth.split(/:/); // split on colon
    let username = parts[0];
    const password = parts[1];
    const newApi = event.queryStringParameters['auth_token'];

    if ((!username || !password) && !newApi) {
      callback(null, {
        statusCode: 401,
        body: JSON.stringify({ error: 'Not Authorized' }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return;
    } else if (!newApi) {
      username = username + ':' + password + '@';
    } else {
      username = '';
    }

    const path = event.path.replace(/\/\.netlify\/functions\/[^\/]+/, '');
    let url = 'https://' + username + 'api.pinboard.in/v1' + path + '?';

    const query = event.queryStringParameters;

    for (const key in query) {
      if (!Object.prototype.hasOwnProperty.call(query, key)) {
        continue;
      }
      url = url + key + '=' + encodeURIComponent(query[key]) + '&';
    }

    request({ url: url }, function(error, response, body) {
      if (error || !response) {
        callback(null, {
          statusCode: 500,
          body: JSON.stringify({ error: 'Error contacting Pinboard API' }),
          headers: {
            'Content-Type': 'application/json',
          },
        });
      } else if (response.statusCode !== 200) {
        callback(null, {
          statusCode: response.statusCode,
          body: body,
          headers: {
            'Content-Type': response.headers['content-type'],
          },
        });
      } else {
        const headers = {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': event.headers.origin || '*',
          'Access-Control-Allow-Headers':
            'Content-Type, X-Requested-With, X-HTTP-Method-Override, Origin, Accept, Authorization',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
        };
        if (query['format'] === 'json') {
          callback(null, {
            statusCode: 200,
            body: body,
            headers: headers,
          });
        } else {
          parser.toJson(body, function(x, obj) {
            callback(null, {
              statusCode: 200,
              body: JSON.stringify(obj),
              headers: headers,
            });
          });
        }
      }
    });
  } else {
    callback(null, {
      statusCode: 405,
      body: 'Method Not Allowed',
    });
  }
};
