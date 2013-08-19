var http = require('http'),
    url = require('url'),
    phantom = require('phantom'),
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

  console.log('Loading[striped]', target);

  if(phantomObj == null){

    phantom.create(function(ph) {
      phantomObj = ph;
      getPage();
    });
  }
  else{
    getPage();
  }

  function getPage() {
    return phantomObj.createPage(function(page) {
      return page.open(target, function(status) {
        var startTime = new Date().getTime();
        console.log('opened', target, 'status:', status, '\n');

        if(status != 'success'){
          serveNonhtml(target, response);
          page.close();
          return;
        }

        function evaluate() {
          console.log('checking if page is ready...');
          page.evaluate((function() {
            var pageReady = false;

            if(!document.doctype){
              return {
                nonhtml: true
              }
            }

            var array = document.getElementsByClassName('seo-render-ready');
            if(array.length > 0){
              pageReady = true;
            }

            function generatePrerendered() {
              //thanks: http://stackoverflow.com/a/10162353/878361
              var node = document.doctype;
              try{
                var doctype = "<!DOCTYPE "
                               + node.name
                               + (node.publicId ? ' PUBLIC "' + node.publicId + '"' : '')
                               + (!node.publicId && node.systemId ? ' SYSTEM' : '') 
                               + (node.systemId ? ' "' + node.systemId + '"' : '')
                               + '>';
              }
              catch(e){
                doctype = "";
              }

              var html = '<html ';

              try{
                var attributes = document.getElementsByTagName('html')[0].attributes
                for(var i = 0; i < attributes.length; i++){
                  var attr = attributes[i];
                  html += '"' + attr.name + '"="' + attr.value + '" ';
                }
              }
              catch(e){}

              html += '>';

              return doctype + html + document.documentElement.innerHTML + '</html>';
            }

            return {
              pageReady: pageReady,
              content: generatePrerendered()
            };
          }), function(result) {

                if(result.nonhtml){
                  serveNonhtml(target, response);
                  return;
                }

                // wait untill there is a result
                var timeoutOccured = (new Date().getTime()) - startTime > readyWaitTimeout;
                if(result.pageReady || timeoutOccured){
                  if(timeoutOccured){
                    console.log('timeout occured, serving');
                  }
                  else{
                    console.log('page is ready, serving');
                  }
                  response.writeHead(200);
                  response.write(result.content);
                  response.end();
                  page.close();
                  return;
                }
                else{
                  console.log('page is not ready, scheduling new evaluation');
                  setTimeout(evaluate, 250);
                }

          });//page evaluate
        }

        evaluate();

      });
    });
  }

}).listen(parseInt(port));
 
function stripEscapeFragment(url) {
  //FIXME use 4 steps on [Mapping from #! to _escaped_fragment_ format] 
  //https://developers.google.com/webmasters/ajax-crawling/docs/specification
  url = url.replace('_escaped_fragment_=', '');
  url = url.replace('_escaped_fragment_', '');
  return url;
}

function serveNonhtml(target, response) {
  console.log('serving non-html', target);

  http.get(target, function(res) {
    console.log("Got response: " + res.statusCode);
    //TODO handle status 302 redirect

    response.writeHead(200, res.headers);
    res.on('data', function (chunk) {
      response.write(chunk, 'binary');
    });

    res.on('end', function (chunk) {
      response.end();
    });

  }).on('error', function(e) {
    console.log("Got error: " + e.message);
    response.writeHead(404);
    response.write('404 Not found');
    response.end();
  });
}

console.log("Prerender server running on localhost:" + port + "\nCTRL + C to shutdown");