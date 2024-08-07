"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ResourceKind = void 0;
/** @import {ResourceKind as ResourceKindEnum} from '@maplibre/maplibre-gl-native' */

/** @type {typeof ResourceKindEnum} */
var ResourceKind = {
  Unknown: 0,
  Style: 1,
  Source: 2,
  Tile: 3,
  Glyphs: 4,
  SpriteImage: 5,
  SpriteJSON: 6
};
exports.ResourceKind = ResourceKind;