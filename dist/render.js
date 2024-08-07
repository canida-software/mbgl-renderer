"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.render = exports.normalizeMapboxStyleURL = exports.normalizeMapboxSpriteURL = exports.normalizeMapboxGlyphURL = exports.isMapboxURL = exports.isMapboxStyleURL = exports.getRemoteTile = exports.getRemoteAsset = exports.getDefaultRequestHandler = exports["default"] = void 0;
var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));
var _toConsumableArray2 = _interopRequireDefault(require("@babel/runtime/helpers/toConsumableArray"));
var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));
var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var _sharp = _interopRequireDefault(require("sharp"));
var _zlib = _interopRequireDefault(require("zlib"));
var _geoViewport = _interopRequireDefault(require("@mapbox/geo-viewport"));
var _maplibreGlNative = _interopRequireDefault(require("@maplibre/maplibre-gl-native"));
var _mbtiles = _interopRequireDefault(require("@mapbox/mbtiles"));
var _pino = _interopRequireDefault(require("pino"));
var _request = _interopRequireDefault(require("request"));
var _url = _interopRequireDefault(require("url"));
var _constants = require("./constants");
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2["default"])(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
var TILE_REGEXP = RegExp('mbtiles://([^/]+)/(\\d+)/(\\d+)/(\\d+)');
var MBTILES_REGEXP = /mbtiles:\/\/(\S+?)(?=[/"]+)/gi;
var logger = (0, _pino["default"])({
  formatters: {
    level: function level(label) {
      return {
        level: label
      };
    }
  },
  redact: {
    paths: ['pid', 'hostname'],
    remove: true
  }
});
_maplibreGlNative["default"].on('message', function (msg) {
  switch (msg.severity) {
    case 'ERROR':
      {
        logger.error(msg.text);
        break;
      }
    case 'WARNING':
      {
        if (msg["class"] === 'ParseStyle') {
          // can't throw an exception here or it crashes NodeJS process
          logger.error("Error parsing style: ".concat(msg.text));
        } else {
          logger.warn(msg.text);
        }
        break;
      }
    default:
      {
        // NOTE: includes INFO
        logger.debug(msg.text);
        break;
      }
  }
});
var isMapboxURL = function isMapboxURL(url) {
  return url.startsWith('mapbox://');
};
exports.isMapboxURL = isMapboxURL;
var isMapboxStyleURL = function isMapboxStyleURL(url) {
  return url.startsWith('mapbox://styles/');
};
exports.isMapboxStyleURL = isMapboxStyleURL;
var isMBTilesURL = function isMBTilesURL(url) {
  return url.startsWith('mbtiles://');
};

// normalize functions derived from: https://github.com/mapbox/mapbox-gl-js/blob/master/src/util/mapbox.js

/**
 * Normalize a Mapbox source URL to a full URL
 *
 * @param {string} url - Url to mapbox source in style json, e.g. "url":
 *   "mapbox://mapbox.mapbox-streets-v7"
 * @param {string} token - Mapbox public token
 */
var normalizeMapboxSourceURL = function normalizeMapboxSourceURL(url, token) {
  try {
    var urlObject = _url["default"].parse(url);
    urlObject.query = urlObject.query || {};
    urlObject.pathname = "/v4/".concat(url.split('mapbox://')[1], ".json");
    urlObject.protocol = 'https';
    urlObject.host = 'api.mapbox.com';
    urlObject.query.secure = true;
    urlObject.query.access_token = token;
    return _url["default"].format(urlObject);
  } catch (e) {
    var msg = "Could not normalize Mapbox source URL: ".concat(url, "\n").concat(e);
    logger.error(msg);
    throw new Error(msg);
  }
};

/**
 * Normalize a Mapbox tile URL to a full URL
 *
 * @param {string} url - Url to mapbox tile in style json or resolved from
 *   source e.g. mapbox://tiles/mapbox.mapbox-streets-v7/1/0/1.vector.pbf
 * @param {string} token - Mapbox public token
 */
var normalizeMapboxTileURL = function normalizeMapboxTileURL(url, token) {
  try {
    var urlObject = _url["default"].parse(url);
    urlObject.query = urlObject.query || {};
    urlObject.pathname = "/v4".concat(urlObject.path);
    urlObject.protocol = 'https';
    urlObject.host = 'a.tiles.mapbox.com';
    urlObject.query.access_token = token;
    return _url["default"].format(urlObject);
  } catch (e) {
    var msg = "Could not normalize Mapbox tile URL: ".concat(url, "\n").concat(e);
    logger.error(msg);
    throw new Error(msg);
  }
};

/**
 * Normalize a Mapbox style URL to a full URL
 *
 * @param {string} url - Url to mapbox source in style json, e.g. "url":
 *   "mapbox://styles/mapbox/streets-v9"
 * @param {string} token - Mapbox public token
 */
var normalizeMapboxStyleURL = function normalizeMapboxStyleURL(url, token) {
  try {
    var urlObject = _url["default"].parse(url);
    urlObject.query = {
      access_token: token,
      secure: true
    };
    urlObject.pathname = "styles/v1".concat(urlObject.path);
    urlObject.protocol = 'https';
    urlObject.host = 'api.mapbox.com';
    return _url["default"].format(urlObject);
  } catch (e) {
    var msg = "Could not normalize Mapbox style URL: ".concat(url, "\n").concat(e);
    logger.error(msg);
    throw new Error(msg);
  }
};

/**
 * Normalize a Mapbox sprite URL to a full URL
 *
 * @param {string} url - Url to mapbox sprite, e.g. "url":
 *   "mapbox://sprites/mapbox/streets-v9.png"
 * @param {string} token - Mapbox public token
 *
 *   Returns {string} - url, e.g.,
 *   "https://api.mapbox.com/styles/v1/mapbox/streets-v9/sprite.png?access_token=<token>"
 */
exports.normalizeMapboxStyleURL = normalizeMapboxStyleURL;
var normalizeMapboxSpriteURL = function normalizeMapboxSpriteURL(url, token) {
  try {
    var extMatch = /(\.png|\.json)$/g.exec(url);
    var ratioMatch = /(@\d+x)\./g.exec(url);
    var trimIndex = Math.min(ratioMatch != null ? ratioMatch.index : Infinity, extMatch.index);
    var urlObject = _url["default"].parse(url.substring(0, trimIndex));
    var extPart = extMatch[1];
    var ratioPart = ratioMatch != null ? ratioMatch[1] : '';
    urlObject.query = urlObject.query || {};
    urlObject.query.access_token = token;
    urlObject.pathname = "/styles/v1".concat(urlObject.path, "/sprite").concat(ratioPart).concat(extPart);
    urlObject.protocol = 'https';
    urlObject.host = 'api.mapbox.com';
    return _url["default"].format(urlObject);
  } catch (e) {
    var msg = "Could not normalize Mapbox sprite URL: ".concat(url, "\n").concat(e);
    logger.error(msg);
    throw new Error(msg);
  }
};

/**
 * Normalize a Mapbox glyph URL to a full URL
 *
 * @param {string} url - Url to mapbox sprite, e.g. "url":
 *   "mapbox://sprites/mapbox/streets-v9.png"
 * @param {string} token - Mapbox public token
 *
 *   Returns {string} - url, e.g.,
 *   "https://api.mapbox.com/styles/v1/mapbox/streets-v9/sprite.png?access_token=<token>"
 */
exports.normalizeMapboxSpriteURL = normalizeMapboxSpriteURL;
var normalizeMapboxGlyphURL = function normalizeMapboxGlyphURL(url, token) {
  try {
    var urlObject = _url["default"].parse(url);
    urlObject.query = urlObject.query || {};
    urlObject.query.access_token = token;
    urlObject.pathname = "/fonts/v1".concat(urlObject.path);
    urlObject.protocol = 'https';
    urlObject.host = 'api.mapbox.com';
    return _url["default"].format(urlObject);
  } catch (e) {
    var msg = "Could not normalize Mapbox glyph URL: ".concat(url, "\n").concat(e);
    logger.error(msg);
    throw new Error(msg);
  }
};

/**
 * Very simplistic function that splits out mbtiles service name from the URL
 *
 * @param {string} url - URL to resolve
 */
exports.normalizeMapboxGlyphURL = normalizeMapboxGlyphURL;
var resolveNamefromURL = function resolveNamefromURL(url) {
  return url.split('://')[1].split('/')[0];
};

/**
 * Resolve a URL of a local mbtiles file to a file path Expected to follow this
 * format "mbtiles://<service_name>/*"
 *
 * @param {string} tilePath - Path containing mbtiles files
 * @param {string} url - Url of a data source in style.json file.
 */
var resolveMBTilesURL = function resolveMBTilesURL(tilePath, url) {
  return _path["default"].format({
    dir: tilePath,
    name: resolveNamefromURL(url),
    ext: '.mbtiles'
  });
};

/**
 * Given a URL to a local mbtiles file, get the TileJSON for that to load
 * correct tiles.
 *
 * @param {string} tilePath - Path containing mbtiles files.
 * @param {string} url - Url of a data source in style.json file.
 * @param {Function} callback - Function to call with (err, {data}).
 */
var getLocalTileJSON = function getLocalTileJSON(tilePath, url, callback) {
  var mbtilesFilename = resolveMBTilesURL(tilePath, url);
  var service = resolveNamefromURL(url);
  new _mbtiles["default"](mbtilesFilename, function (err, mbtiles) {
    if (err) {
      callback(err);
      return null;
    }
    mbtiles.getInfo(function (infoErr, info) {
      if (infoErr) {
        callback(infoErr);
        return null;
      }
      var minzoom = info.minzoom,
        maxzoom = info.maxzoom,
        center = info.center,
        bounds = info.bounds,
        format = info.format;
      var ext = format === 'pbf' ? '.pbf' : '';
      var tileJSON = {
        tilejson: '1.0.0',
        tiles: ["mbtiles://".concat(service, "/{z}/{x}/{y}").concat(ext)],
        minzoom: minzoom,
        maxzoom: maxzoom,
        center: center,
        bounds: bounds
      };
      callback(null, {
        data: Buffer.from(JSON.stringify(tileJSON))
      });
      return null;
    });
    return null;
  });
};

/**
 * Fetch a tile from a local mbtiles file.
 *
 * @param {string} tilePath - Path containing mbtiles files.
 * @param {string} url - Url of a data source in style.json file.
 * @param {Function} callback - Function to call with (err, {data}).
 */
var getLocalTile = function getLocalTile(tilePath, url, callback) {
  var matches = url.match(TILE_REGEXP);
  var _matches$slice = matches.slice(matches.length - 3, matches.length),
    _matches$slice2 = (0, _slicedToArray2["default"])(_matches$slice, 3),
    z = _matches$slice2[0],
    x = _matches$slice2[1],
    y = _matches$slice2[2];
  var isVector = _path["default"].extname(url) === '.pbf';
  var mbtilesFile = resolveMBTilesURL(tilePath, url);
  new _mbtiles["default"](mbtilesFile, function (err, mbtiles) {
    if (err) {
      callback(err);
      return null;
    }
    mbtiles.getTile(z, x, y, function (tileErr, data) {
      if (tileErr) {
        callback(null, {});
        return null;
      }
      if (isVector) {
        // if the tile is compressed, unzip it (for vector tiles only!)
        _zlib["default"].unzip(data, function (unzipErr, unzippedData) {
          callback(unzipErr, {
            data: unzippedData
          });
        });
      } else {
        callback(null, {
          data: data
        });
      }
      return null;
    });
    return null;
  });
};

/**
 * Fetch a remotely hosted tile. Empty or missing tiles return null data to the
 * callback function, which results in those tiles not rendering but no errors
 * being raised.
 *
 * @param {string} url - URL of the tile
 * @param {Function} callback - Callback to call with (err, {data})
 * @param {Record<string, string>} [requestHeaders] - Optional request headers
 */
var getRemoteTile = function getRemoteTile(url, callback, requestHeaders) {
  (0, _request["default"])({
    url: url,
    encoding: null,
    gzip: true,
    headers: requestHeaders
  }, function (err, res, data) {
    if (err) {
      return callback(err);
    }
    switch (res.statusCode) {
      case 200:
        {
          return callback(null, {
            data: data
          });
        }
      case 204:
        {
          // No data for this url
          return callback(null, {});
        }
      case 404:
        {
          // Tile not found
          // this may be valid for some tilesets that have partial coverage
          // on servers that do not return blank tiles in these areas.
          logger.warn("Missing tile at: ".concat(url));
          return callback(null, {});
        }
      default:
        {
          // assume error
          var msg = "request for remote tile failed: ".concat(url, " (status: ").concat(res.statusCode, ")");
          logger.error(msg);
          return callback(new Error(msg));
        }
    }
  });
};

/**
 * Fetch a remotely hosted asset: glyph, sprite, etc Anything other than a HTTP
 * 200 response results in an exception.
 *
 * @param {string} url - URL of the asset
 * @param {Function} callback - Callback to call with (err, {data})
 * @param {Record<string, string>} [requestHeaders] - Optional request headers
 */
exports.getRemoteTile = getRemoteTile;
var getRemoteAsset = function getRemoteAsset(url, callback, requestHeaders) {
  (0, _request["default"])({
    url: url,
    encoding: null,
    gzip: true,
    requestHeaders: requestHeaders
  }, function (err, res, data) {
    if (err) {
      return callback(err);
    }
    switch (res.statusCode) {
      case 200:
        {
          return callback(null, {
            data: data
          });
        }
      default:
        {
          var msg = "request for remote asset failed: ".concat(res.request.uri.href, " (status: ").concat(res.statusCode, ")");
          logger.error(msg);
          return callback(new Error(msg));
        }
    }
  });
};

/**
 * Fetch a remotely hosted asset: glyph, sprite, etc Anything other than a HTTP
 * 200 response results in an exception.
 *
 * @param {string} url - URL of the asset
 * @returns {Promise} Returns a Promise
 */
exports.getRemoteAsset = getRemoteAsset;
var getRemoteAssetPromise = function getRemoteAssetPromise(url) {
  return new Promise(function (resolve, reject) {
    getRemoteAsset(url, function (err, data) {
      if (err) {
        return reject(err);
      }
      return resolve(data);
    });
  });
};

/**
 * RequestHandler constructs a request handler for the map to load resources.
 *
 * @param {string | null} tilePath - Path to tilesets (optional)
 * @param {string | null} token - Mapbox GL token (optional; required for any
 *   Mapbox hosted resources)
 * @returns {RequestHandler}
 */
var getDefaultRequestHandler = function getDefaultRequestHandler(tilePath, token) {
  var _handler;
  /** @type {RequestHandler} */
  var handler = (_handler = {}, (0, _defineProperty2["default"])(_handler, _constants.ResourceKind.Source, function (url, callback) {
    if (isMBTilesURL(url)) {
      if (!tilePath) {
        var msg = "Requesting local tiles \"".concat(url, "\" but parameter tilePath is missing.");
        return callback(new Error(msg));
      }
      getLocalTileJSON(tilePath, url, callback);
    } else if (isMapboxURL(url)) {
      if (!token) {
        var _msg = "Requesting MapBox tiles \"".concat(url, "\" but parameter token is missing.");
        return callback(new Error(_msg));
      }
      getRemoteAsset(normalizeMapboxSourceURL(url, token), callback);
    } else {
      getRemoteAsset(url, callback);
    }
  }), (0, _defineProperty2["default"])(_handler, _constants.ResourceKind.Tile, function (url, callback) {
    if (isMBTilesURL(url)) {
      if (!tilePath) {
        var msg = "Requesting local tile \"".concat(url, "\" but parameter tilePath is missing.");
        return callback(new Error(msg));
      }
      getLocalTile(tilePath, url, callback);
    } else if (isMapboxURL(url)) {
      // This seems to be due to a bug in how the mapbox tile
      // JSON is handled within mapbox-gl-native
      // since it returns fully resolved tiles!
      if (!token) {
        var _msg2 = "Requesting MapBox tiles \"".concat(url, "\" but parameter token is missing.");
        return callback(new Error(_msg2));
      }
      getRemoteTile(normalizeMapboxTileURL(url, token), callback);
    } else {
      getRemoteTile(url, callback);
    }
  }), (0, _defineProperty2["default"])(_handler, _constants.ResourceKind.Glyphs, function (url, callback) {
    if (isMapboxURL(url) && !token) {
      var msg = "Requesting MapBox tiles \"".concat(url, "\" but parameter token is missing.");
      return callback(new Error(msg));
    }
    getRemoteAsset(isMapboxURL(url) && token ? normalizeMapboxGlyphURL(url, token) : new URL(url).href, callback);
  }), (0, _defineProperty2["default"])(_handler, _constants.ResourceKind.SpriteImage, function (url, callback) {
    if (isMapboxURL(url) && !token) {
      var msg = "Requesting MapBox tiles \"".concat(url, "\" but parameter token is missing.");
      return callback(new Error(msg));
    }
    getRemoteAsset(isMapboxURL(url) && token ? normalizeMapboxSpriteURL(url, token) : new URL(url).href, callback);
  }), (0, _defineProperty2["default"])(_handler, _constants.ResourceKind.SpriteJSON, function (url, callback) {
    if (isMapboxURL(url) && !token) {
      var msg = "Requesting MapBox tiles \"".concat(url, "\" but parameter token is missing.");
      return callback(new Error(msg));
    }
    getRemoteAsset(isMapboxURL(url) && token ? normalizeMapboxSpriteURL(url, token) : new URL(url).href, callback);
  }), (0, _defineProperty2["default"])(_handler, 7, function _(url, callback) {
    // image source
    // probably an artifact from mapbox gl native and not part of maplibre gl native
    getRemoteAsset(new URL(url).href, callback);
  }), _handler);
  return handler;
};

/**
 * Load an icon image from base64 data or a URL and add it to the map.
 *
 * @param {object} map - Mapbox GL map object
 * @param {string} id - Id of image to add
 * @param {object} options - Options object with {url, pixelRatio, sdf}. url is
 *   required
 * @param {string} options.url
 * @param {number} options.pixelRatio
 * @param {boolean} options.sdf
 */
exports.getDefaultRequestHandler = getDefaultRequestHandler;
var loadImage = /*#__PURE__*/function () {
  var _ref2 = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee(map, id, _ref) {
    var url, _ref$pixelRatio, pixelRatio, _ref$sdf, sdf, msg, imgBuffer, _img, img, metadata, data, _msg3;
    return _regenerator["default"].wrap(function _callee$(_context) {
      while (1) switch (_context.prev = _context.next) {
        case 0:
          url = _ref.url, _ref$pixelRatio = _ref.pixelRatio, pixelRatio = _ref$pixelRatio === void 0 ? 1 : _ref$pixelRatio, _ref$sdf = _ref.sdf, sdf = _ref$sdf === void 0 ? false : _ref$sdf;
          if (url) {
            _context.next = 5;
            break;
          }
          msg = "Invalid url for image: ".concat(id);
          logger.error(msg);
          throw new Error(msg);
        case 5:
          _context.prev = 5;
          imgBuffer = null;
          if (!url.startsWith('data:')) {
            _context.next = 11;
            break;
          }
          imgBuffer = Buffer.from(url.split('base64,')[1], 'base64');
          _context.next = 15;
          break;
        case 11:
          _context.next = 13;
          return getRemoteAssetPromise(url);
        case 13:
          _img = _context.sent;
          imgBuffer = _img.data;
        case 15:
          img = (0, _sharp["default"])(imgBuffer);
          _context.next = 18;
          return img.metadata();
        case 18:
          metadata = _context.sent;
          _context.next = 21;
          return img.raw().toBuffer();
        case 21:
          data = _context.sent;
          _context.next = 24;
          return map.addImage(id, data, {
            width: metadata.width,
            height: metadata.height,
            pixelRatio: pixelRatio,
            sdf: sdf
          });
        case 24:
          _context.next = 31;
          break;
        case 26:
          _context.prev = 26;
          _context.t0 = _context["catch"](5);
          _msg3 = "Error loading icon image: ".concat(id, "\n").concat(_context.t0);
          logger.error(_msg3);
          throw new Error(_msg3);
        case 31:
        case "end":
          return _context.stop();
      }
    }, _callee, null, [[5, 26]]);
  }));
  return function loadImage(_x, _x2, _x3) {
    return _ref2.apply(this, arguments);
  };
}();

/**
 * Load all icon images to the map.
 *
 * @param {object} map - Mapbox GL map object
 * @param {object} images - Object with {id: {url, ...other image properties}}
 */
var loadImages = /*#__PURE__*/function () {
  var _ref3 = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee3(map, images) {
    var imageRequests;
    return _regenerator["default"].wrap(function _callee3$(_context3) {
      while (1) switch (_context3.prev = _context3.next) {
        case 0:
          if (!(images !== null)) {
            _context3.next = 4;
            break;
          }
          imageRequests = Object.entries(images).map( /*#__PURE__*/function () {
            var _ref4 = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee2(image) {
              return _regenerator["default"].wrap(function _callee2$(_context2) {
                while (1) switch (_context2.prev = _context2.next) {
                  case 0:
                    _context2.next = 2;
                    return loadImage.apply(void 0, [map].concat((0, _toConsumableArray2["default"])(image)));
                  case 2:
                  case "end":
                    return _context2.stop();
                }
              }, _callee2);
            }));
            return function (_x6) {
              return _ref4.apply(this, arguments);
            };
          }()); // await for all requests to complete
          _context3.next = 4;
          return Promise.all(imageRequests);
        case 4:
        case "end":
          return _context3.stop();
      }
    }, _callee3);
  }));
  return function loadImages(_x4, _x5) {
    return _ref3.apply(this, arguments);
  };
}();

/**
 * Render the map, returning a Promise.
 *
 * @param {object} map - Mapbox GL map object
 * @param {object} options - Mapbox GL map options
 */
var renderMap = function renderMap(map, options) {
  return new Promise(function (resolve, reject) {
    map.render(options, function (err, buffer) {
      if (err) {
        return reject(err);
      }
      return resolve(buffer);
    });
  });
};

/**
 * Convert premultiplied image buffer from Mapbox GL to RGBA PNG format.
 *
 * @param {Uint8Array} buffer - Image data buffer
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number} ratio - Image pixel ratio
 */
var toPNG = /*#__PURE__*/function () {
  var _ref5 = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee4(buffer, width, height, ratio) {
    var i, alpha, norm;
    return _regenerator["default"].wrap(function _callee4$(_context4) {
      while (1) switch (_context4.prev = _context4.next) {
        case 0:
          // Un-premultiply pixel values
          // Mapbox GL buffer contains premultiplied values, which are not handled correctly by sharp
          // https://github.com/mapbox/mapbox-gl-native/issues/9124
          // since we are dealing with 8-bit RGBA values, normalize alpha onto 0-255 scale and divide
          // it out of RGB values

          for (i = 0; i < buffer.length; i += 4) {
            alpha = buffer[i + 3];
            norm = alpha / 255;
            if (alpha === 0) {
              buffer[i] = 0;
              buffer[i + 1] = 0;
              buffer[i + 2] = 0;
            } else {
              buffer[i] /= norm;
              buffer[i + 1] = buffer[i + 1] / norm;
              buffer[i + 2] = buffer[i + 2] / norm;
            }
          }
          return _context4.abrupt("return", (0, _sharp["default"])(buffer, {
            raw: {
              width: width * ratio,
              height: height * ratio,
              channels: 4
            }
          }).png().toBuffer());
        case 2:
        case "end":
          return _context4.stop();
      }
    }, _callee4);
  }));
  return function toPNG(_x7, _x8, _x9, _x10) {
    return _ref5.apply(this, arguments);
  };
}();

/**
 * Asynchronously render a map using Mapbox GL, based on layers specified in
 * style. Returns PNG image data (via async / Promise).
 *
 * If zoom and center are not provided, bounds must be provided and will be used
 * to calculate center and zoom based on image dimensions.
 *
 * @param {object} style - Mapbox GL style object
 * @param {number} [width] - Width of output map (default: 1024)
 * @param {number} [height] - Height of output map (default: 1024)
 * @param {object} options - Configuration object
 * @param {number[]} [options.center] - Center coordinates [lng, lat]
 * @param {number} [options.zoom] - Zoom level
 * @param {number[]} [options.bounds] - Bounds [west, south, east, north]
 * @param {number} [options.bearing] - Bearing angle (0-360)
 * @param {number} [options.pitch] - Pitch angle (0-60)
 * @param {string} [options.token] - Mapbox access token
 * @param {number} [options.ratio] - Pixel ratio
 * @param {number} [options.padding] - Padding in pixels
 * @param {object} [options.images] - Images object
 * @param {string} [options.tilePath] - Path to directory containing local
 *   mbtiles files
 * @param {PartialRequestHandler} [requestHandler] - (Optional) Will be used
 *   during a Map.render call to request all necessary map resources (tiles,
 *   fonts...)
 * @returns {Promise<Buffer>} - PNG image data
 * @throws {Error} - Throws error if required parameters are missing or invalid
 */
var render = /*#__PURE__*/function () {
  var _ref6 = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee5(style) {
    var width,
      height,
      options,
      requestHandler,
      _options$bounds,
      bounds,
      _options$bearing,
      bearing,
      _options$pitch,
      pitch,
      _options$token,
      token,
      _options$ratio,
      ratio,
      _options$padding,
      padding,
      _options$images,
      images,
      _options$center,
      center,
      _options$zoom,
      zoom,
      _options$tilePath,
      tilePath,
      msg,
      _msg4,
      _msg5,
      _msg6,
      _msg7,
      _msg8,
      _msg9,
      _msg10,
      _msg11,
      viewport,
      localMbtilesMatches,
      _msg12,
      map,
      buffer,
      _args5 = arguments;
    return _regenerator["default"].wrap(function _callee5$(_context5) {
      while (1) switch (_context5.prev = _context5.next) {
        case 0:
          width = _args5.length > 1 && _args5[1] !== undefined ? _args5[1] : 1024;
          height = _args5.length > 2 && _args5[2] !== undefined ? _args5[2] : 1024;
          // @ts-ignore because switching order may break stuff
          options = _args5.length > 3 ? _args5[3] : undefined;
          requestHandler = _args5.length > 4 ? _args5[4] : undefined;
          _options$bounds = options.bounds, bounds = _options$bounds === void 0 ? null : _options$bounds, _options$bearing = options.bearing, bearing = _options$bearing === void 0 ? 0 : _options$bearing, _options$pitch = options.pitch, pitch = _options$pitch === void 0 ? 0 : _options$pitch, _options$token = options.token, token = _options$token === void 0 ? null : _options$token, _options$ratio = options.ratio, ratio = _options$ratio === void 0 ? 1 : _options$ratio, _options$padding = options.padding, padding = _options$padding === void 0 ? 0 : _options$padding, _options$images = options.images, images = _options$images === void 0 ? null : _options$images;
          _options$center = options.center, center = _options$center === void 0 ? null : _options$center, _options$zoom = options.zoom, zoom = _options$zoom === void 0 ? null : _options$zoom, _options$tilePath = options.tilePath, tilePath = _options$tilePath === void 0 ? null : _options$tilePath;
          if (style) {
            _context5.next = 9;
            break;
          }
          msg = 'style is a required parameter';
          throw new Error(msg);
        case 9:
          if (width && height) {
            _context5.next = 12;
            break;
          }
          _msg4 = 'width and height are required parameters and must be non-zero';
          throw new Error(_msg4);
        case 12:
          if (!(center !== null)) {
            _context5.next = 22;
            break;
          }
          if (!(center.length !== 2)) {
            _context5.next = 16;
            break;
          }
          _msg5 = "Center must be longitude,latitude.  Invalid value found: ".concat((0, _toConsumableArray2["default"])(center));
          throw new Error(_msg5);
        case 16:
          if (!(Math.abs(center[0]) > 180)) {
            _context5.next = 19;
            break;
          }
          _msg6 = "Center longitude is outside world bounds (-180 to 180 deg): ".concat(center[0]);
          throw new Error(_msg6);
        case 19:
          if (!(Math.abs(center[1]) > 90)) {
            _context5.next = 22;
            break;
          }
          _msg7 = "Center latitude is outside world bounds (-90 to 90 deg): ".concat(center[1]);
          throw new Error(_msg7);
        case 22:
          if (!(zoom !== null && (zoom < 0 || zoom > 22))) {
            _context5.next = 25;
            break;
          }
          _msg8 = "Zoom level is outside supported range (0-22): ".concat(zoom);
          throw new Error(_msg8);
        case 25:
          if (!(bearing !== null && (bearing < 0 || bearing > 360))) {
            _context5.next = 28;
            break;
          }
          _msg9 = "bearing is outside supported range (0-360): ".concat(bearing);
          throw new Error(_msg9);
        case 28:
          if (!(pitch !== null && (pitch < 0 || pitch > 60))) {
            _context5.next = 31;
            break;
          }
          _msg10 = "pitch is outside supported range (0-60): ".concat(pitch);
          throw new Error(_msg10);
        case 31:
          if (!(bounds !== null)) {
            _context5.next = 40;
            break;
          }
          if (!(bounds.length !== 4)) {
            _context5.next = 35;
            break;
          }
          _msg11 = "Bounds must be west,south,east,north.  Invalid value found: ".concat((0, _toConsumableArray2["default"])(bounds));
          throw new Error(_msg11);
        case 35:
          if (!padding) {
            _context5.next = 40;
            break;
          }
          if (!(Math.abs(padding) >= width / 2)) {
            _context5.next = 38;
            break;
          }
          throw new Error('Padding must be less than width / 2');
        case 38:
          if (!(Math.abs(padding) >= height / 2)) {
            _context5.next = 40;
            break;
          }
          throw new Error('Padding must be less than height / 2');
        case 40:
          // calculate zoom and center from bounds and image dimensions
          if (bounds !== null && (zoom === null || center === null)) {
            viewport = _geoViewport["default"].viewport(bounds,
            // add padding to width and height to effectively
            // zoom out the target zoom level.
            [width - 2 * padding, height - 2 * padding], undefined, undefined, undefined, true);
            zoom = Math.max(viewport.zoom - 1, 0);
            /* eslint-disable prefer-destructuring */
            center = viewport.center;
          }

          // validate that all local mbtiles referenced in style are
          // present in tilePath and that tilePath is not null
          if (tilePath) {
            tilePath = _path["default"].normalize(tilePath);
          }
          localMbtilesMatches = JSON.stringify(style).match(MBTILES_REGEXP);
          if (!(localMbtilesMatches && !tilePath)) {
            _context5.next = 46;
            break;
          }
          _msg12 = 'Style has local mbtiles file sources, but no tilePath is set';
          throw new Error(_msg12);
        case 46:
          if (localMbtilesMatches && tilePath) {
            localMbtilesMatches.forEach(function (name) {
              var mbtileFilename = _path["default"].normalize(_path["default"].format({
                dir: tilePath,
                name: name.split('://')[1],
                ext: '.mbtiles'
              }));
              if (!_fs["default"].existsSync(mbtileFilename)) {
                var _msg13 = "Mbtiles file ".concat(_path["default"].format({
                  name: name,
                  ext: '.mbtiles'
                }), " in style file is not found in: ").concat(_path["default"].resolve(tilePath));
                throw new Error(_msg13);
              }
            });
          }
          map = new _maplibreGlNative["default"].Map({
            request: function request(_ref7, callback) {
              var url = _ref7.url,
                kind = _ref7.kind;
              var isMapbox = isMapboxURL(url);
              if (isMapbox && !token) {
                var _msg14 = 'mapbox access token is required';
                logger.error(_msg14);
                return callback(new Error(_msg14));
              }
              var handler = _objectSpread(_objectSpread({}, getDefaultRequestHandler(tilePath, token)), requestHandler);

              /** @type {RequestFn | undefined} */
              var requestFn = handler[kind];
              try {
                if (!requestFn) {
                  // NOT HANDLED!
                  var _msg15 = "error Request kind not handled: ".concat(kind);
                  logger.error(_msg15);
                  throw new Error(_msg15);
                }
                requestFn(url, callback);
              } catch (err) {
                var _msg16 = "Error while making resource request to: ".concat(url, "\n").concat(err);
                logger.error(_msg16);
                return callback(new Error(_msg16));
              }
            },
            ratio: ratio
          });
          map.load(style);
          _context5.next = 51;
          return loadImages(map, images);
        case 51:
          _context5.next = 53;
          return renderMap(map, {
            zoom: zoom,
            center: center,
            height: height,
            width: width,
            bearing: bearing,
            pitch: pitch
          });
        case 53:
          buffer = _context5.sent;
          return _context5.abrupt("return", toPNG(buffer, width, height, ratio));
        case 55:
        case "end":
          return _context5.stop();
      }
    }, _callee5);
  }));
  return function render(_x11) {
    return _ref6.apply(this, arguments);
  };
}();
exports.render = render;
var _default = render;
exports["default"] = _default;