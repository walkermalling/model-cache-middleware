require('dotenv').config({ path: './.cachemw' });
const ramda = require('ramda');
const Fantasy = require('ramda-fantasy');
const fs = require('fs');
const pathJoin = require('path').join;
const crypto = require('crypto');

const Future = Fantasy.Future;

const cacheDir = process.env.CACHE_DIR || `${process.cwd()}/cache`;

const dirExists = (path) => new Future((reject, resolve) => {
  fs.stat(path, (err, stats) => {
    if (err || !stats) {
      fs.mkdirSync(path);
      console.log(`created cache dir ${path}`);
    }
    resolve(path);
  });
});

function urlToFilePath(path) {
  return pathJoin(
    cacheDir,
    `${crypto.createHash('md5').update(path).digest('hex')}.json`
  );
}

const fsPut = (path, data) => new Future((reject, resolve) => {
  const file = `${cacheDir}/${urlToFilePath(path)}.json`;
  fs.writeFile(file, JSON.stringify(data), (writeErr, writeData) => {
    if (writeErr) {
      reject(writeErr);
    } else {
      resolve(path, writeData);
    }
  });
});

const fsGet = (path) => new Future((reject, resolve) => {
  const file = `${cacheDir}/${urlToFilePath(path)}.json`;
  fs.readFile(file, (readErr, readData) => {
    if (readErr) {
      reject(readErr);
    } else if (!readData) {
      reject({ error: 'no data', message: `fs.readFile for ${path} returned no data` });
    } else {
      try {
        resolve(JSON.parse(readData));
      } catch (e) {
        reject(e);
      }
    }
  });
});

// TODO(walker): fsDel

const cacheMiddleware = (req, res, next) => {
  if (req.query.hasOwnProperty('cache')) {
    fsGet(req.path).fork(
      function onReject(fsGetErr) {
        console.log({ error: fsGetErr, message: 'could not get cached model', path: req.path });
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
  } else if (req.query.hasOwnProperty('bust')) {
    // TODO(walker): bust cache
    res.set('X-CACHE-MW', 'cache=busted ');
    next();
  } else {
    res.set('X-CACHE-MW', 'ready');
    next();
  }
};

module.exports = {
  cacheMiddleware,
  fsGet,
  fsPut,
  dirExists,
  urlToFilePath,
};
