# webp-ondemand

A simple service to convert images to WebP format on demand.
Supports virtual hosts and [client hints](https://developers.google.com/web/updates/2015/09/automating-resource-selection-with-client-hints)

## Configuration

Configuration is read from `.env` files located in the same directory as `index.js`.

The application processes `.env` files in the following order:

  1. `.env.defaults`
  2. `.env`
  3. `.env.local`
  4. `.env.ENVIRONMENT`
  5. `.env.ENVIRONMENT.local`

`ENVIRONMENT` is the value of `NODE_ENV` environment variable (defaults to `development` if not set).

The following configuration options are supported:

  * **LISTEN_HOST** (default: `127.0.0.1`): the application will listen for incoming connections on this host
  * **PORT** (default: 7777): the application will listen for incoming connections on this port
  * **CONTENT_NEGOTIATION** (default: 1): whether content negotiation is enabled (1) or not (0). If enabled, the application
    will use Save-Data, ECT, RTT, and Downlink HTTP headers to set quality of the webp image, and DPR, Width, and Viewport-Width
    headers to resize the image (note that the image is never enlarged)
  * **MAX_AGE** (default: 864000): specifies the maximum amount of time, in seconds, the image will be considered fresh by the client.
    Used in `Cache-Control` response header
  * **ACH_LIFETIME** (default: 864000): the length of time, in seconds, the browser should remember the value set for `Accept-CH`
  * **HOSTMAP**: maps Host request header to a document root. The format is: `domain1:/path/to/domain1/docroot;domain2:/path/to/domain2/doctoot`.
    If `domain` part starts with a dot, the `document root` part will be used for all subdomains of that domain.
    For a "catch-all" path use empty domain part, for example: `HOSTMAP=example.com:/var/www/example.com;:/catch/all/path`

## How it Works

The server expects a path to the real filename with `.webp` extension appended. For example, to serve `https://example.com/image.png`
as WebP, the server should be given `https://example.com/image.png.webp` URL.

The application parses the URL: the domain part (`example.com` is this case) is used to find the document root (base path).
The path part ('/image.png.webp') is then appended to the document root, and `.webp` extension is removed.

For `HOSTMAP=example.com:/var/www/example.com` and `https://example.com/image.png.webp` the path will be `/var/www/example.com/image.png`.

If the file does not exists, or the application failed to find the domain in the host map, it returns a 404 error.

If there is `If-Modified-Since` request header, and the source file has not been modified since the given timestamp,
the application will return 304 Not Modified, saving bandwidth and CPU time.

The application then analyzes the query string. It recognizes the following parameters:

  * **q** (integer): the desired quality of the image (0…100, 0 being worst)
  * **w** (integer): the extrinsic width of the image (corresponds to `Width` [client hint](https://developers.google.com/web/fundamentals/performance/optimizing-content-efficiency/client-hints/#width))
  * **vw** (integer): the width of the viewport (corresponds to `Viewport-Width` [client hint](https://developers.google.com/web/fundamentals/performance/optimizing-content-efficiency/client-hints/#viewport-width))
  * **dpr** (float): device pixel ratio (corresponds to `DPR` [client hint](https://developers.google.com/web/fundamentals/performance/optimizing-content-efficiency/client-hints/#dpr))

When `q` is specified in the query string, the application does *not* analyze request headers and does *not* send Vary, Accept-CH, or Accept-CH-Lifetime headers.
This is by design: Cloudflare, for example, does not support content negotiation (possibly except `Accept-Encoding` header),
and, for example, if one client asks for an image and sets `Width: 400` request header, and another client asks for the same image
and sets `Width` to a different value (say, 800), it will receive the 400px image from Cloudflare. Query string parameters allow
for overcoming this inconvenience (for example, a service worker can intercept requests to load images, look for client hints headers,
and construct a proper URL to get the WebP image — which can be safely cached by a CDN).

If `q` is not specified, the aspplication caluclates `q`, `w`, `vw`, and `dpr` values from client hints headers:
  * Save-Data, ECT, RTT, and Downlink contribute to image quality: the worse the connection is, the lower quality will be;
  * Width becomes `w`, Viewport-Width becomes `vw`, and DPR becomes `dpr`.

Otherwise, if there are no client hints specified, the application will not try to resize the source image.

The application then reads the source image and, if necessary, resizes it according to client hints.
If any dimension of the resized image is greather than 16383px (maximum allowed length of a WebP image),
the images is *not* converted to WebP and served in the original format (there are [exceptions](https://sharp.dimens.io/en/stable/api-output/#tobuffer): GIF and SVG gets converted to PNG
due to limitations of the used image processing library).

If the request method is HEAD, the application sends only response headers. If the request method is GET,
the application sends both headers and the image.

The application sends the following headers:

  * Cache-Control: public, max-age and s-max-age correspond to `MAX_AGE` value form `.env`
  * Content-Length: size of the image in bytes
  * Content-Type: usually image/webp, but may vary if width or height of the image is greater than 16383px

If content negotiation is eanbled (`CONTENT_NEGOTIATION` in `.env`), then the following headers are sent:

  * `Accept-CH: Width, Viewport-Width, DPR, RTT, ECT, Downlink`
  * `Vary: Width, DPR, Save-Data, RTT, ECT, Downlink, Viewport-Width`
  * `Content-DPR` if there was `Width` header in the request
  * `Accept-CH-Lifetime` if `ACH_LIFETIME` in `.env` is non-zero

## webp-ondemand and nginx

It makes sense to cache generated .webp files. A web server is the best place for that :-)

If you use `nginx`, you can adapt this sample configuration to your needs:

```nginx
proxy_cache_path /var/lib/nginx/webp levels=2 use_temp_path=off keys_zone=webpimg:20m max_size=1024m inactive=48h;

server {
# ...
    proxy_cache webpimg;
    proxy_cache_key "$request_method:$scheme:$proxy_host:$request_uri";
    proxy_cache_methods GET;
    proxy_cache_revalidate on;
    proxy_cache_use_stale error timeout http_500 http_502 http_503 http_504 http_403 updating;
    proxy_cache_valid 200 48h;
    proxy_cache_valid 404 1m;
    proxy_buffering on;
    proxy_set_header Host $http_host;

    location @webp {
        proxy_pass http://127.0.0.1:7777;
    }
#...
}
```

If some of your hosts have to use a service, which does not support content negotiation properly (hey, Cloudflare!),
you may need to add the following piece of code:

```nginx
    proxy_pass_request_headers off;
    proxy_hide_header Vary;
    proxy_hide_header Accept-CH;
    proxy_hide_header Accept-CH-Lifetime;
    proxy_ignore_headers Vary;
```

More about [`ngx_http_proxy_module`](http://nginx.org/en/docs/http/ngx_http_proxy_module.html)
