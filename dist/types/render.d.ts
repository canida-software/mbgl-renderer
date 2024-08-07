import { ResourceKind, RequestResponse } from '@maplibre/maplibre-gl-native';

export type RequestFn = (
  url: string,
  callback: (error?: Error, response?: RequestResponse) => void
) => void;

export type RequestHandler = {
  /** `Source` request handler */
  [ResourceKind.Source]: RequestFn,
  /** `Tile` request handler */
  [ResourceKind.Tile]: RequestFn,
  /** `Glyphs` request handler */
  [ResourceKind.Glyphs]: RequestFn,
  /** `SpriteImage` request handler */
  [ResourceKind.SpriteImage]: RequestFn,
  /** `SpriteJSON` request handler */
  [ResourceKind.SpriteJSON]: RequestFn,
  /** DO NOT USE! Artifact for handling `ImageSource` requests. May be removed soon.*/
  7: RequestFn, // remaining artifact after refactoring, probably only existed in mapbox and not maplibre
}

export type PartialRequestHandler = Partial<Omit<RequestHandler, 7>> // removed 7 because it should not be used anymore outside of the default request handler
