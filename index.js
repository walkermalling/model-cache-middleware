require('dotenv').config({ path: './.cachemw' });
const lib = require('./lib');
const ramda = require('ramda');

const fsGet = lib.fsGet;
const fsPut = lib.fsPut;
const fsDel = lib.fsDel;
const pathExists = lib.pathExists;
const getPath = lib.getPath;
const contains = ramda.contains;

function cacheActionRequested(req) {
  // NOTE(walker) to prevent unintentional query parameters from having undesired side effects
  // if the header is set, ignore query parameters
  // this means that the client should set the header to any value, except cache|bust
  const header = req.headers['x-cache-mw'];
  if (header) {
    if (contains(header, ['cache', 'bust'])) {
      return header;
    }
    return null;
  }
  if (req.query.hasOwnProperty('cache')) {
    return 'cache';
  }
  if (req.query.hasOwnProperty('bust')) {
    return 'bust';
  }
  return null;
}

const cacheMiddleware = (req, res, next) => {
  switch (cacheActionRequested(req)) {
    case 'cache':
      getPath(req.path).chain(fsGet).fork(
        function onReject(fsGetErr) {
          console.log({ error: fsGetErr.code, message: 'could not get cached model', path: req.path });
          res.set('X-CACHE-MW', 'cache=false');

          const originalRender = res.render;
          res.render = function newRender (viewName, model, renderCallback) {
            fsPut(req.path, model).fork(console.log, console.log);
            originalRender.call(res, viewName, model, renderCallback);
          };

          const originalJson = res.json;
          res.json = function newJsonResponse (model) {
            fsPut(req.path, model).fork(console.log, console.log);
            originalJson.call(res, model);
          };

          next();
        },
        function onResolve(cachedModel) {
          res.set('X-CACHE-MW', 'cache=true');
          res.json(cachedModel);
        }
      );
      break;
    case 'bust':
      getPath(req.path).chain(pathExists).chain(fsDel).fork(
        (err) => {
          res.set('X-CACHE-MW', 'cache=error');
          console.log(err);
          next();
        },
        (info) => {
          console.log(`resolved del chain`);
          res.set('X-CACHE-MW', 'cache=busted ');
          next();
        }
      );
      break;
    default:
      res.set('X-CACHE-MW', 'ready');
      next();
  }
};

module.exports = cacheMiddleware;
