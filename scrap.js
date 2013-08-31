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

var
  system = require('system'),
  page = require('webpage').create(),
  result = {
    log: [],
    content: '',
    header: '',
    status: 404
  },
  headersFetched = false,
  WAIT_TIMEOUT = Infinity,
  waitStartTime;

if (system.args.length < 2) {
  result.log.push("ERROR: wrong number of arguments!");
  result.log.push('Usage: dumppage.js <some URL>');
  exit();
}

var url = system.args[1];

result.log.push('Loading page: ' + url);

phantom.onError = function (msg, trace) {
  var msgStack = ['PHANTOM ERROR: ' + msg];
  if (trace && trace.length) {
      msgStack.push('TRACE:');
      trace.forEach(function(t) {
          msgStack.push(' -> ' + (t.file || t.sourceURL) + ': ' + t.line + (t.function ? ' (in function ' + t.function + ')' : ''));
      });
  }
  result.log.push(msgStack.join('\n'));
  exit();
}

function exit() {
  console.log('<result>', JSON.stringify(result));
  phantom.exit();
}

page.open(url);
page.onLoadFinished = function(status) {
  result.content = page.content;
  result.status = status == 'success' ? 200 : 404;

  var isInjected = page.injectJs("waitCriteria.js");

  waitStartTime = (new Date()).getTime();

  waitOrGo(page, isInjected);
};

page.onResourceReceived = function(response) {
  //store header of first successful response
  if(!headersFetched && response.status == 200){
    headersFetched = true;
    result.headers = response.headers;
  }
}

page.onConsoleMessage = function(msg, lineNum, sourceId) {
  console.log('js console: ' + msg )
  result.log.push('js console: ' + msg );
};

function waitOrGo(page, isInjected) {
  var findIt = page.evaluate(function(isInjected, waitStartTime, WAIT_TIMEOUT) {

    var isTimeout = (new Date()).getTime() - waitStartTime < WAIT_TIMEOUT;

    if(isInjected && typeof prerender_isDone == 'function' && isTimeout){
      console.log('prerender checking');
      return prerender_isDone();
    }
    else{
      if(isTimeout){
        console.log('timeout occured');
        result.log.push('timeout occured');
      }
      console.log('retrying');
      return true;
    }
  }, isInjected, waitStartTime, WAIT_TIMEOUT);

  if(!findIt){
    setTimeout(waitOrGo, 250, page, isInjected);
    return
  }

  result.content = page.content;
  exit();
}