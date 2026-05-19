/**
 * Angular dev-server proxy.
 *
 * The `selfHandleResponse: false` + `buffer` overrides are explicit because
 * the default behaviour through http-proxy can stall on SSE / chunked
 * responses for very fast streams (tokens arrive faster than Node flushes
 * the proxy buffer). We tell the proxy: don't transform, don't buffer,
 * just pipe.
 */
module.exports = {
  '/api': {
    target: 'http://backend:8000',
    secure: false,
    changeOrigin: true,
    ws: false,
    // Forward SSE responses unbuffered. http-proxy honours the upstream
    // Content-Type, but Node's stream pipeline can still hold on to bytes
    // briefly if the response is gzip-compatible. Stripping accept-encoding
    // on streaming requests guarantees no compressor sits in the middle.
    onProxyReq(proxyReq, req) {
      if (req.url && req.url.endsWith('/stream')) {
        proxyReq.removeHeader('accept-encoding');
      }
    },
    onProxyRes(proxyRes) {
      if ((proxyRes.headers['content-type'] || '').includes('text/event-stream')) {
        proxyRes.headers['cache-control'] = 'no-cache, no-transform';
        proxyRes.headers['x-accel-buffering'] = 'no';
      }
    },
  },
};
