prerender
=========

What does this do?
------------------

Serves any web page to SEOs as rendered. In other words executes all js and wait for all html to be generated before serving.

How to use?
-----------

Basically proxy_pass all requests coming from SEO bots to `prerender` server, and you're done.

Example nginx configuration
---------------------------

*...with existing Passenger config*

Assuming that nginx is configured by Passenger automatically hence you have default Passenger nginx configuration.

Go to `/opt/nginx/conf/` and create a new file `prerender.conf`

**prerender.conf**

```
set $needPrerender "";

if ($request_uri ~ '_escaped_fragment_') {
  set $needPrerender "Y";
}

if ($http_user_agent ~* (googlebot|bingbot|yahooseeker|slurp) ) {
  set $needPrerender "Y";
}

if ($http_accept ~* 'html') {
  set $needPrerender "${needPrerender}ES";
}

if ($needPrerender = "YES") {
  rewrite ^ /?url=$scheme://$http_host$request_uri break;
  proxy_pass http://localhost:7737;
}
```

Then in the same directory, open existing `nginx.conf`

**nginx.conf**

there is a commented out block in `server` block as:

```
#location / {
    #root   html;
    #index  index.html index.htm;
#}
```

change it into:

```
location / {
    passenger_enabled on;
    root /your/rails/project/path/public;
    include prerender.conf;
}
``` 

Note that `root /your/rails/project/path/public` should be the same with the one in the top of server block in your `nginx.conf` file, write below the `passenger_enabled on;` row.

```
...
server {
    listen       80;
    server_name  localhost;
    passenger_enabled on;

    root /your/rails/project/path/public;
    ...
    ...
```

finally reload nginx:

```
sudo service nginx reload
```
