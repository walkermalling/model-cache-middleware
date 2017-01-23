const ramda = require('ramda');
const Fantasy = require('ramda-fantasy');
const fs = require('fs');
const pathJoin = require('path').join;
const crypto = require('crypto');

const Future = Fantasy.Future;

const cacheDir = process.env.CACHE_DIR || `${process.cwd()}/cache`;

const pathExists = (path) => new Future((reject, resolve) => {
  fs.stat(path, (err, stats) => {
    if (err || !stats) {
      reject(err);
    } else {
      resolve(path);
    }
  });
});

const createPath = path => new Future((reject, resolve) => {
  fs.mkdir(path, (err) => {
    if (err) {
      reject(err);
    } else {
      resolve(path);
    }
  });
});

function urlToFilePath(path) {
  return pathJoin(
    cacheDir,
    `${crypto.createHash('md5').update(path).digest('hex')}.json`
  );
}

function getPath(path) {
  return new Future((reject, resolve) => resolve(
    pathJoin(
      cacheDir,
      `${crypto.createHash('md5').update(path).digest('hex')}.json`
    )
  ));
}

const fsPut = (path, data) => new Future((reject, resolve) => {
  const file = urlToFilePath(path);
  fs.writeFile(file, JSON.stringify(data), (writeErr, writeData) => {
    if (writeErr) {
      reject(writeErr);
    } else {
      resolve(path, writeData);
    }
  });
});

const fsGet = (path) => new Future((reject, resolve) => {
  fs.readFile(path, (readErr, readData) => {
    if (readErr) {
      reject(readErr);
    } else if (!readData) {
      reject({ error: 'readFile returned no data', path });
    } else {
      try {
        resolve(JSON.parse(readData));
      } catch (e) {
        reject(e);
      }
    }
  });
});

const fsDel = (path) => new Future((reject, resolve) => {
  fs.unlink(path, (delError) => {
    if (delError) {
      reject(delError);
    } else {
      resolve(path);
    }
  });
});

module.exports = {
  fsGet,
  fsPut,
  fsDel,
  pathExists,
  createPath,
  urlToFilePath,
  getPath,
};
