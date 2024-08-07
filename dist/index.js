"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "ResourceKind", {
  enumerable: true,
  get: function get() {
    return _constants.ResourceKind;
  }
});
exports["default"] = void 0;
Object.defineProperty(exports, "getDefaultRequestHandler", {
  enumerable: true,
  get: function get() {
    return _render.getDefaultRequestHandler;
  }
});
Object.defineProperty(exports, "getRemoteAsset", {
  enumerable: true,
  get: function get() {
    return _render.getRemoteAsset;
  }
});
Object.defineProperty(exports, "getRemoteTile", {
  enumerable: true,
  get: function get() {
    return _render.getRemoteTile;
  }
});
Object.defineProperty(exports, "isMBTilesURL", {
  enumerable: true,
  get: function get() {
    return _render.isMBTilesURL;
  }
});
Object.defineProperty(exports, "isMapboxStyleURL", {
  enumerable: true,
  get: function get() {
    return _render.isMapboxStyleURL;
  }
});
Object.defineProperty(exports, "isMapboxURL", {
  enumerable: true,
  get: function get() {
    return _render.isMapboxURL;
  }
});
Object.defineProperty(exports, "normalizeMapboxGlyphURL", {
  enumerable: true,
  get: function get() {
    return _render.normalizeMapboxGlyphURL;
  }
});
Object.defineProperty(exports, "normalizeMapboxSourceURL", {
  enumerable: true,
  get: function get() {
    return _render.normalizeMapboxSourceURL;
  }
});
Object.defineProperty(exports, "normalizeMapboxSpriteURL", {
  enumerable: true,
  get: function get() {
    return _render.normalizeMapboxSpriteURL;
  }
});
Object.defineProperty(exports, "normalizeMapboxStyleURL", {
  enumerable: true,
  get: function get() {
    return _render.normalizeMapboxStyleURL;
  }
});
Object.defineProperty(exports, "normalizeMapboxTileURL", {
  enumerable: true,
  get: function get() {
    return _render.normalizeMapboxTileURL;
  }
});
var _render = require("./render");
var _constants = require("./constants");
var _default = _render.render;
exports["default"] = _default;