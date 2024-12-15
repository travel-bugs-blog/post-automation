import { match } from 'path-to-regexp';

class Router {
  constructor() {
    this.routes = [];
  }

  registerRoute(method, path, handler) {
    this.routes.push({ method, path, handler });
  }

  get(path, handler) {
    this.registerRoute('GET', path, handler);
  }

  post(path, handler) {
    this.registerRoute('POST', path, handler);
  }

  put(path, handler) {
    this.registerRoute('PUT', path, handler);
  }

  delete(path, handler) {
    this.registerRoute('DELETE', path, handler);
  }

  patch(path, handler) {
    this.registerRoute('PATCH', path, handler);
  }

  all(path, handler) {
    this.registerRoute('ALL', path, handler);
  }

  handleRequest(req, res) {
    try {
      // Ensure req.path is a valid string path
      if (!req.path || typeof req.path !== 'string') {
        throw new Error('Invalid req.path');
      }

      for (const route of this.routes) {
        const matchFn = match(route.path, { decode: decodeURIComponent });
        const matched = matchFn(req.path);

        if (matched && (route.method === req.method || route.method === 'ALL')) {
          // Populate req.params with matched parameters
          req.params = matched.params || {};
          return route.handler(req, res);
        }
      }

      res.status(404).json({ error: 'Not Found' });
    } catch (err) {
      res.status(500).json({ error: `Router error: ${err.message}` });
    }
  }
}

export default Router;