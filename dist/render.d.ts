export function isMapboxURL(url: any): any;
export function isMapboxStyleURL(url: any): any;
export function normalizeMapboxStyleURL(url: string, token: string): string;
export function normalizeMapboxSpriteURL(url: string, token: string): string;
export function normalizeMapboxGlyphURL(url: string, token: string): string;
export function getDefaultRequestHandler(tilePath: string | null, token: string | null): RequestHandler;
export function render(style: object, width?: number | undefined, height?: number | undefined, options: {
    center?: number[] | undefined;
    zoom?: number | undefined;
    bounds?: number[] | undefined;
    bearing?: number | undefined;
    pitch?: number | undefined;
    token?: string | undefined;
    ratio?: number | undefined;
    padding?: number | undefined;
    images?: object;
    tilePath?: string | undefined;
}, requestHandler?: Partial<Omit<RequestHandler, 7>> | undefined): Promise<Buffer>;
export default render;
import type { RequestHandler } from './types/render';
//# sourceMappingURL=render.d.ts.map