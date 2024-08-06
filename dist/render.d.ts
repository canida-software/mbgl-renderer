export function isMapboxURL(url: any): any;
export function isMapboxStyleURL(url: any): any;
export function normalizeMapboxStyleURL(url: string, token: string): string;
export function normalizeMapboxSpriteURL(url: string, token: string): string;
export function normalizeMapboxGlyphURL(url: string, token: string): string;
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
}, requestHandler?: RequestHandler | undefined): Promise<Buffer>;
export default render;
import type { RequestHandler } from './types/render';
//# sourceMappingURL=render.d.ts.map