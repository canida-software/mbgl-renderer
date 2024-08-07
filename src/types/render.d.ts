import { ResourceKind, RequestResponse } from '@maplibre/maplibre-gl-native';

export type RequestFn = (
  url: string,
  callback: (error?: Error, response?: RequestResponse) => void
) => void;

export type RequestHandler = {
  [ResourceKind.Source]: RequestFn,
  [ResourceKind.Tile]: RequestFn,
  [ResourceKind.Glyphs]: RequestFn,
  [ResourceKind.SpriteImage]: RequestFn,
  [ResourceKind.SpriteJSON]: RequestFn,
  7: RequestFn, // remaining artifact after refactoring, probably only existed in mapbox and not maplibre
}

export type PartialRequestHandler = Partial<Omit<RequestHandler, 7>> // removed 7 because it should not be used anymore outside of the default request handler



