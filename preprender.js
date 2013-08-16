var http = require('http'),
    url = require('url'),
    phantom = require('phantom'),
    port = process.argv[2] || 7737;// 7737:prer for "preR"ender

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

  // only prerender html content
  if(request.headers.accept.indexOf('html') == -1){
    // redirect non-html content to original server but with an overriden user-agent
    console.log('redirecting', target);
    response.writeHead(302, {
      'Location': target,
      'user-agent': 'prerender-server'// avoid infinite redirection loop (thru nginx)
    });
    response.end();
    return;
  }

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
        console.log('opened', target, '?', status, '\n');

        if(status != 'success'){
          console.log('422 Unprocessable Entity: url cannot be opened!\n', request.url, '\n');
          response.writeHead(422);
          response.write('422 Unprocessable Entity: url cannot be opened!\n' + request.url);
          response.end();
          page.close();
          return;
        }

        return page.evaluate((function() {

          //TODO wait until some condition is hold

          //thanks: http://stackoverflow.com/a/10162353/878361
          var node = document.doctype;
          var doctype = "<!DOCTYPE "
                   + node.name
                   + (node.publicId ? ' PUBLIC "' + node.publicId + '"' : '')
                   + (!node.publicId && node.systemId ? ' SYSTEM' : '') 
                   + (node.systemId ? ' "' + node.systemId + '"' : '')
                   + '>';

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
        }), function(result) {
          // console.log('Page title is ' + result);

          response.writeHead(200);
          response.write(result);
          response.end();
          page.close();
          return;
        });
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

console.log("Prerender server running on localhost:" + port + "\nCTRL + C to shutdown");