const config = require('./config');
const netQuality = require('./netquality');
const imgQuality = require('./imgquality');
const fs = require('fs');
const url = require('url');
const sharp = require('sharp');

/**
 * @param {string} host
 * @param {Object.<string, string>} hostMap
 * @returns {?string}
 */
function findDocRoot (host, hostMap) {
  if (host in hostMap) {
    return hostMap[host];
  }

  const keys = Object.keys(hostMap).filter(key => key.startsWith('.'));
  for (let key of keys) {
    if (key.endsWith(host)) {
      return hostMap[key];
    }
  }

  if ('' in hostMap) {
    return hostMap[''];
  }

  return null;
}

/**
 * @param {http.ServerResponse} response
 */
function error400 (response) {
  response.statusCode = 400;
  response.setHeader('Cache-Control', 'private, no-cache, no-store');
  response.setHeader('Expires', 'Sat, 25 Aug 1991 03:00:00 GMT');
  response.setHeader('Conetnt-Type', 'text/plain; charset=utf-8');
  response.end('Bad Request');
}

/**
 * @param {http.ServerResponse} response
 */
function error403 (response) {
  response.statusCode = 403;
  response.setHeader('Cache-Control', 'private, no-cache, no-store');
  response.setHeader('Expires', 'Sat, 25 Aug 1991 03:00:00 GMT');
  response.setHeader('Conetnt-Type', 'text/plain; charset=utf-8');
  response.end('Forbidden');
}

/**
 * @param {http.ServerResponse} response
 */
function error404 (response) {
  response.statusCode = 404;
  response.setHeader('Cache-Control', 'private, no-cache, no-store');
  response.setHeader('Expires', 'Sat, 25 Aug 1991 03:00:00 GMT');
  response.setHeader('Conetnt-Type', 'text/plain; charset=utf-8');
  response.end('Not Found');
}

/**
 * @param {http.ServerResponse} response
 */
function error405 (response) {
  response.statusCode = 405;
  response.setHeader('Cache-Control', 'private, no-cache, no-store');
  response.setHeader('Expires', 'Sat, 25 Aug 1991 03:00:00 GMT');
  response.setHeader('Conetnt-Type', 'text/plain; charset=utf-8');
  response.end('Method Not Allowed');
}

/**
 * @param {http.ServerResponse} response
 */
function error500 (response) {
  response.statusCode = 500;
  response.setHeader('Cache-Control', 'private, no-cache, no-store');
  response.setHeader('Expires', 'Sat, 25 Aug 1991 03:00:00 GMT');
  response.setHeader('Conetnt-Type', 'text/plain; charset=utf-8');
  response.end('Internal Server Error');
}

/**
 * @param {http.ServerResponse} response
 * @param {Date} mtime
 * @param {boolean} negotiate
 */
function sendOKHeaders (response, mtime, negotiate) {
  response.setHeader('Cache-Control', `public, max-age=${config.MAX_AGE}, s-max-age=${config.MAX_AGE}`);
  response.setHeader('Last-Modified', mtime.toGMTString());
  if (negotiate) {
    response.setHeader('Accept-CH', 'Width, Viewport-Width, DPR, RTT, ECT, Downlink');
    response.setHeader('Accept-CH-Lifetime', config.ACH_LIEFTIME);
    response.setHeader('Vary', 'Width, DPR, Save-Data, RTT, ECT, Downlink, Viewport-Width');
  }
}

/**
 * @param {http.ServerResponse} response
 * @param {string} file
 * @param {fs.Stats} stats
 * @param {Number} quality
 * @param {Number} width
 * @param {Number} dpr
 * @param {boolean} negotiate
 * @param {boolean} needCDPR
 * @param {boolean} isHEAD
 * @returns
 */
function adaptImage (response, file, stats, quality, width, dpr, negotiate, needCDPR, isHEAD) {
  let img = sharp(file);
  let cd = 0.0;
  img.metadata().then(function (metadata) {
    const imageWidth = metadata.width;
    const imageHeight = metadata.height;
    let newWidth = imageWidth;
    if (width) {
      newWidth = Math.min(width, imageWidth);
      cd = newWidth / width * dpr;
    }

    const newHeight = imageHeight * newWidth / imageWidth;
    if (newHeight < 16383 && newWidth < 16383) {
      response.setHeader('Content-Type', 'image/webp');
    } else {
      let format = metadata.format;
      if (format === 'gif' || format === 'svg') {
        format = 'png';
      }

      response.setHeader('Content-Type', `image/${format}`);
    }

    if (newWidth !== imageWidth) {
      img = img.resize({ width: newWidth });
    }

    if (newHeight < 16383 && newWidth < 16383) {
      img = img.webp({ quality });
    }

    img.toBuffer().then(buf => {
      sendOKHeaders(response, stats.mtime);
      response.setHeader('Content-Length', buf.length);
      if (needCDPR && cd) {
        response.setHeader('Content-DPR', Math.round(cd * 100) / 100);
      }

      if (isHEAD) {
        response.end();
      } else {
        response.end(buf);
      }
    }).catch(e => error500(response));
  }).catch(e => error500(response));
}

/**
 * @param {http.IncomingMessage} request
 * @param {http.ServerResponse} response
 */
function requestHandler (request, response) {
  const method = request.method;
  if (method !== 'GET' && method !== 'HEAD') {
    return error405(response);
  }

  const docroot = findDocRoot((request.headers.host + '').toLowerCase(), config.HOSTMAP);
  if (docroot === null) {
    return error404(response);
  }

  const parsed = url.parse(request.url, true);
  const pathname = parsed.pathname;
  const query = parsed.query;

  if (/\.webp$/.test(pathname)) {
    const source = docroot + pathname.slice(0, -5);
    // const target = docroot + pathname;
    fs.stat(source, (err, stats) => {
      if (err) {
        return (err.code === 'EPERM') ? error403(response) : error404(response);
      }

      if (request.headers['if-modified-since']) {
        const since = new Date(request.headers['if-modified-since']);
        stats.mtime.setMilliseconds(0);
        if (stats.mtime <= since) {
          response.statusCode = 304;
          response.setHeader('Cache-Control', `public, max-age=${config.MAX_AGE}, s-max-age=${config.MAX_AGE}`);
          response.setHeader('Last-Modified', stats.mtime.toGMTString());
          return response.end();
        }
      }

      let q = 80; let dpr = 1; let w = 0; let vw = 0; let needCDPR = false; let neg = false;
      if (query.q) {
        q = parseInt(query.q, 10) || 80;
        dpr = parseInt(query.dpr, 10) || 1;
        w = parseInt(query.w, 10) || 0;
        vw = parseInt(query.vw, 10) || 0;
      } else if (config.CONTENT_NEGOTIATION && (request.headers.ect || request.headers.width || request.headers['viewport-width'] || request.headers['save-data'])) {
        const sd = request.headers['save-sata'] === 'on';
        const ect = request.headers.ect || '4g';
        const rtt = parseInt(request.headers.rtt, 10) || 0;
        const dl = request.headers.downlink;
        const nq = netQuality(sd, rtt, ect, dl);
        q = imgQuality(nq);
        neg = true;
        w = parseInt(request.headers.width, 10) || 0;
        vw = parseInt(request.headers['viewport-width'], 10) || 0;
        dpr = sd ? 1 : (parseInt(request.headers.dpr, 10) || 1);
        needCDPR = w > 0;
      }

      w = w > 0 ? w : vw;
      if (w < 0 || q <= 0 || q > 100 || dpr <= 0) {
        return error400(response);
      }

      return adaptImage(response, source, stats, q, w, dpr, neg, needCDPR, request.method === 'HEAD');
    });
  } else {
    return error404(response);
  }
}

module.exports = requestHandler;
