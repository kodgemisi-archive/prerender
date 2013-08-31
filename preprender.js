/*
prerender-server is a proxy server which serves any web page to 
SEOs as fully rendered by javascript.

Copyright (C) 2013 Destan Sarpkaya [destan@kodgemisi.com]

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see {http://www.gnu.org/licenses/}
*/

var http = require('http'),
    url = require('url'),
    exec = require('child_process').exec,
    port = process.argv[2] || 7737,// 7737:prer for "preR"ender
    readyWaitTimeout = 10000;

process.on('uncaughtException', function(err) {
  console.error('Caught exception: ' + err);
  console.log(err);
});
 
var phantomObj = null;

http.createServer(function(request, response) {

  var target = url.parse(request.url).query ? url.parse(request.url).query.replace('url=', '') : null;

  if(target == null){
    console.log('422 Unprocessable Entity: url parameter is missing!\n', request.url + '\n');
    response.writeHead(422);
    response.write('422 Unprocessable Entity: url parameter is missing!\n' + request.url);
    response.end();
    return;
  }

  console.log('Loading', target);

  target = stripEscapeFragment(target);
  var statusCode = 200;

  console.log('Loading[striped]', target);

  try{
    child = exec('phantomjs --load-images=false scrap.js ' + target + " | grep -E '^<result>'"
    ,function (error, stdout, stderr) {
        var result = JSON.parse(stdout.replace(/^<result>/, ''));

        response.writeHead(result.status, createHeaders(result.headers));
        response.write(result.content, 'utf8');
        response.end();
        console.log('served', target, result.status);
      }
    );
  }
  catch(e){
    response.writeHead(500);
    response.write('server error', 'utf8');
    response.end();
  }

}).listen(parseInt(port));
 
function stripEscapeFragment(url) {
  //FIXME use 4 steps on [Mapping from #! to _escaped_fragment_ format] 
  //https://developers.google.com/webmasters/ajax-crawling/docs/specification
  url = url.replace('_escaped_fragment_=', '');
  url = url.replace('_escaped_fragment_', '');
  return url;
}

function createHeaders(headers) {
  var result = {};
  for(var i=0; i < headers.length; i++){
    var h = headers[i];
    result[h.name.toLocaleLowerCase()] = h.value;
  }

  //delete gzip stuff otherwise page is not rendered 
  delete result['content-encoding'];

  return result;
}

console.log("Prerender server running on localhost:" + port + "\nCTRL + C to shutdown");