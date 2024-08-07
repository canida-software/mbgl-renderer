/** @import {RequestHandler, RequestFn, PartialRequestHandler} from './types/render' */
/* eslint-disable no-new */
import fs from 'fs'
import path from 'path'
// sharp must be before zlib and other imports or sharp gets wrong version of zlib and breaks on some servers
import sharp from 'sharp'
import zlib from 'zlib'
import geoViewport from '@mapbox/geo-viewport'
import maplibre from '@maplibre/maplibre-gl-native'
import MBTiles from '@mapbox/mbtiles'
import pino from 'pino'
import webRequest from 'request'
import urlLib from 'url'
import { ResourceKind } from './constants'

const TILE_REGEXP = RegExp('mbtiles://([^/]+)/(\\d+)/(\\d+)/(\\d+)')
const MBTILES_REGEXP = /mbtiles:\/\/(\S+?)(?=[/"]+)/gi

const logger = pino({
    formatters: {
        level: (label) => ({ level: label }),
    },
    redact: {
        paths: ['pid', 'hostname'],
        remove: true,
    },
})

maplibre.on('message', (msg) => {
    switch (msg.severity) {
        case 'ERROR': {
            logger.error(msg.text)
            break
        }
        case 'WARNING': {
            if (msg.class === 'ParseStyle') {
                // can't throw an exception here or it crashes NodeJS process
                logger.error(`Error parsing style: ${msg.text}`)
            } else {
                logger.warn(msg.text)
            }
            break
        }

        default: {
            // NOTE: includes INFO
            logger.debug(msg.text)
            break
        }
    }
})

export const isMapboxURL = (url) => url.startsWith('mapbox://')
export const isMapboxStyleURL = (url) => url.startsWith('mapbox://styles/')
export const isMBTilesURL = (url) => url.startsWith('mbtiles://')

// normalize functions derived from: https://github.com/mapbox/mapbox-gl-js/blob/master/src/util/mapbox.js

/**
 * Normalize a Mapbox source URL to a full URL
 *
 * @param {string} url - Url to mapbox source in style json, e.g. "url":
 *   "mapbox://mapbox.mapbox-streets-v7"
 * @param {string} token - Mapbox public token
 */
export const normalizeMapboxSourceURL = (url, token) => {
    try {
        const urlObject = urlLib.parse(url)
        urlObject.query = urlObject.query || {}
        urlObject.pathname = `/v4/${url.split('mapbox://')[1]}.json`
        urlObject.protocol = 'https'
        urlObject.host = 'api.mapbox.com'
        urlObject.query.secure = true
        urlObject.query.access_token = token
        return urlLib.format(urlObject)
    } catch (e) {
        const msg = `Could not normalize Mapbox source URL: ${url}\n${e}`
        logger.error(msg)
        throw new Error(msg)
    }
}

/**
 * Normalize a Mapbox tile URL to a full URL
 *
 * @param {string} url - Url to mapbox tile in style json or resolved from
 *   source e.g. mapbox://tiles/mapbox.mapbox-streets-v7/1/0/1.vector.pbf
 * @param {string} token - Mapbox public token
 */
export const normalizeMapboxTileURL = (url, token) => {
    try {
        const urlObject = urlLib.parse(url)
        urlObject.query = urlObject.query || {}
        urlObject.pathname = `/v4${urlObject.path}`
        urlObject.protocol = 'https'
        urlObject.host = 'a.tiles.mapbox.com'
        urlObject.query.access_token = token
        return urlLib.format(urlObject)
    } catch (e) {
        const msg = `Could not normalize Mapbox tile URL: ${url}\n${e}`
        logger.error(msg)
        throw new Error(msg)
    }
}

/**
 * Normalize a Mapbox style URL to a full URL
 *
 * @param {string} url - Url to mapbox source in style json, e.g. "url":
 *   "mapbox://styles/mapbox/streets-v9"
 * @param {string} token - Mapbox public token
 */
export const normalizeMapboxStyleURL = (url, token) => {
    try {
        const urlObject = urlLib.parse(url)
        urlObject.query = {
            access_token: token,
            secure: true,
        }
        urlObject.pathname = `styles/v1${urlObject.path}`
        urlObject.protocol = 'https'
        urlObject.host = 'api.mapbox.com'
        return urlLib.format(urlObject)
    } catch (e) {
        const msg = `Could not normalize Mapbox style URL: ${url}\n${e}`
        logger.error(msg)
        throw new Error(msg)
    }
}

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
export const normalizeMapboxSpriteURL = (url, token) => {
    try {
        const extMatch = /(\.png|\.json)$/g.exec(url)
        const ratioMatch = /(@\d+x)\./g.exec(url)
        const trimIndex = Math.min(
            ratioMatch != null ? ratioMatch.index : Infinity,
            extMatch.index
        )
        const urlObject = urlLib.parse(url.substring(0, trimIndex))

        const extPart = extMatch[1]
        const ratioPart = ratioMatch != null ? ratioMatch[1] : ''
        urlObject.query = urlObject.query || {}
        urlObject.query.access_token = token
        urlObject.pathname = `/styles/v1${urlObject.path}/sprite${ratioPart}${extPart}`
        urlObject.protocol = 'https'
        urlObject.host = 'api.mapbox.com'
        return urlLib.format(urlObject)
    } catch (e) {
        const msg = `Could not normalize Mapbox sprite URL: ${url}\n${e}`
        logger.error(msg)
        throw new Error(msg)
    }
}

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
export const normalizeMapboxGlyphURL = (url, token) => {
    try {
        const urlObject = urlLib.parse(url)
        urlObject.query = urlObject.query || {}
        urlObject.query.access_token = token
        urlObject.pathname = `/fonts/v1${urlObject.path}`
        urlObject.protocol = 'https'
        urlObject.host = 'api.mapbox.com'
        return urlLib.format(urlObject)
    } catch (e) {
        const msg = `Could not normalize Mapbox glyph URL: ${url}\n${e}`
        logger.error(msg)
        throw new Error(msg)
    }
}

/**
 * Very simplistic function that splits out mbtiles service name from the URL
 *
 * @param {string} url - URL to resolve
 */
const resolveNamefromURL = (url) => url.split('://')[1].split('/')[0]

/**
 * Resolve a URL of a local mbtiles file to a file path Expected to follow this
 * format "mbtiles://<service_name>/*"
 *
 * @param {string} tilePath - Path containing mbtiles files
 * @param {string} url - Url of a data source in style.json file.
 */
const resolveMBTilesURL = (tilePath, url) =>
    path.format({
        dir: tilePath,
        name: resolveNamefromURL(url),
        ext: '.mbtiles',
    })

/**
 * Given a URL to a local mbtiles file, get the TileJSON for that to load
 * correct tiles.
 *
 * @param {string} tilePath - Path containing mbtiles files.
 * @param {string} url - Url of a data source in style.json file.
 * @param {Function} callback - Function to call with (err, {data}).
 */
const getLocalTileJSON = (tilePath, url, callback) => {
    const mbtilesFilename = resolveMBTilesURL(tilePath, url)
    const service = resolveNamefromURL(url)

    new MBTiles(mbtilesFilename, (err, mbtiles) => {
        if (err) {
            callback(err)
            return null
        }

        mbtiles.getInfo((infoErr, info) => {
            if (infoErr) {
                callback(infoErr)
                return null
            }

            const { minzoom, maxzoom, center, bounds, format } = info

            const ext = format === 'pbf' ? '.pbf' : ''

            const tileJSON = {
                tilejson: '1.0.0',
                tiles: [`mbtiles://${service}/{z}/{x}/{y}${ext}`],
                minzoom,
                maxzoom,
                center,
                bounds,
            }

            callback(null, { data: Buffer.from(JSON.stringify(tileJSON)) })
            return null
        })

        return null
    })
}

/**
 * Fetch a tile from a local mbtiles file.
 *
 * @param {string} tilePath - Path containing mbtiles files.
 * @param {string} url - Url of a data source in style.json file.
 * @param {Function} callback - Function to call with (err, {data}).
 */
const getLocalTile = (tilePath, url, callback) => {
    const matches = url.match(TILE_REGEXP)
    const [z, x, y] = matches.slice(matches.length - 3, matches.length)
    const isVector = path.extname(url) === '.pbf'
    const mbtilesFile = resolveMBTilesURL(tilePath, url)

    new MBTiles(mbtilesFile, (err, mbtiles) => {
        if (err) {
            callback(err)
            return null
        }

        mbtiles.getTile(z, x, y, (tileErr, data) => {
            if (tileErr) {
                callback(null, {})
                return null
            }

            if (isVector) {
                // if the tile is compressed, unzip it (for vector tiles only!)
                zlib.unzip(data, (unzipErr, unzippedData) => {
                    callback(unzipErr, { data: unzippedData })
                })
            } else {
                callback(null, { data })
            }

            return null
        })

        return null
    })
}

/**
 * Fetch a remotely hosted tile. Empty or missing tiles return null data to the
 * callback function, which results in those tiles not rendering but no errors
 * being raised.
 *
 * @param {string} url - URL of the tile
 * @param {Function} callback - Callback to call with (err, {data})
 * @param {Record<string, string>} [requestHeaders] - Optional request headers
 */
export const getRemoteTile = (url, callback, requestHeaders) => {
    webRequest(
        {
            url,
            encoding: null,
            gzip: true,
            headers: requestHeaders,
        },
        (err, res, data) => {
            if (err) {
                return callback(err)
            }

            switch (res.statusCode) {
                case 200: {
                    return callback(null, { data })
                }
                case 204: {
                    // No data for this url
                    return callback(null, {})
                }
                case 404: {
                    // Tile not found
                    // this may be valid for some tilesets that have partial coverage
                    // on servers that do not return blank tiles in these areas.
                    logger.warn(`Missing tile at: ${url}`)
                    return callback(null, {})
                }
                default: {
                    // assume error
                    const msg = `request for remote tile failed: ${url} (status: ${res.statusCode})`
                    logger.error(msg)
                    return callback(new Error(msg))
                }
            }
        }
    )
}

/**
 * Fetch a remotely hosted asset: glyph, sprite, etc Anything other than a HTTP
 * 200 response results in an exception.
 *
 * @param {string} url - URL of the asset
 * @param {Function} callback - Callback to call with (err, {data})
 * @param {Record<string, string>} [requestHeaders] - Optional request headers
 */
export const getRemoteAsset = (url, callback, requestHeaders) => {
    webRequest(
        {
            url,
            encoding: null,
            gzip: true,
            requestHeaders,
        },
        (err, res, data) => {
            if (err) {
                return callback(err)
            }

            switch (res.statusCode) {
                case 200: {
                    return callback(null, { data })
                }
                default: {
                    const msg = `request for remote asset failed: ${res.request.uri.href} (status: ${res.statusCode})`
                    logger.error(msg)
                    return callback(new Error(msg))
                }
            }
        }
    )
}

/**
 * Fetch a remotely hosted asset: glyph, sprite, etc Anything other than a HTTP
 * 200 response results in an exception.
 *
 * @param {string} url - URL of the asset
 * @returns {Promise} Returns a Promise
 */
const getRemoteAssetPromise = (url) => {
    return new Promise((resolve, reject) => {
        getRemoteAsset(url, (err, data) => {
            if (err) {
                return reject(err)
            }
            return resolve(data)
        })
    })
}

/**
 * RequestHandler constructs a request handler for the map to load resources.
 *
 * @param {string | null} tilePath - Path to tilesets (optional)
 * @param {string | null} token - Mapbox GL token (optional; required for any
 *   Mapbox hosted resources)
 * @returns {RequestHandler}
 */
export const getDefaultRequestHandler = (tilePath, token) => {
    /** @type {RequestHandler} */
    const handler = {
        [ResourceKind.Source]: (url, callback) => {
            if (isMBTilesURL(url)) {
                if (!tilePath) {
                    const msg = `Requesting local tiles "${url}" but parameter tilePath is missing.`
                    return callback(new Error(msg))
                }
                getLocalTileJSON(tilePath, url, callback)
            } else if (isMapboxURL(url)) {
                if (!token) {
                    const msg = `Requesting MapBox tiles "${url}" but parameter token is missing.`
                    return callback(new Error(msg))
                }
                getRemoteAsset(normalizeMapboxSourceURL(url, token), callback)
            } else {
                getRemoteAsset(url, callback)
            }
        },
        [ResourceKind.Tile]: (url, callback) => {
            if (isMBTilesURL(url)) {
                if (!tilePath) {
                    const msg = `Requesting local tile "${url}" but parameter tilePath is missing.`
                    return callback(new Error(msg))
                }
                getLocalTile(tilePath, url, callback)
            } else if (isMapboxURL(url)) {
                // This seems to be due to a bug in how the mapbox tile
                // JSON is handled within mapbox-gl-native
                // since it returns fully resolved tiles!
                if (!token) {
                    const msg = `Requesting MapBox tiles "${url}" but parameter token is missing.`
                    return callback(new Error(msg))
                }
                getRemoteTile(normalizeMapboxTileURL(url, token), callback)
            } else {
                getRemoteTile(url, callback)
            }
        },
        [ResourceKind.Glyphs]: (url, callback) => {
            if (isMapboxURL(url) && !token) {
                const msg = `Requesting MapBox tiles "${url}" but parameter token is missing.`
                return callback(new Error(msg))
            }
            getRemoteAsset(
                isMapboxURL(url) && token
                    ? normalizeMapboxGlyphURL(url, token)
                    : new URL(url).href,
                callback
            )
        },
        [ResourceKind.SpriteImage]: (url, callback) => {
            if (isMapboxURL(url) && !token) {
                const msg = `Requesting MapBox tiles "${url}" but parameter token is missing.`
                return callback(new Error(msg))
            }
            getRemoteAsset(
                isMapboxURL(url) && token
                    ? normalizeMapboxSpriteURL(url, token)
                    : new URL(url).href,
                callback
            )
        },
        [ResourceKind.SpriteJSON]: (url, callback) => {
            if (isMapboxURL(url) && !token) {
                const msg = `Requesting MapBox tiles "${url}" but parameter token is missing.`
                return callback(new Error(msg))
            }
            getRemoteAsset(
                isMapboxURL(url) && token
                    ? normalizeMapboxSpriteURL(url, token)
                    : new URL(url).href,
                callback
            )
        },
        7: (url, callback) => {
            // image source
            // probably an artifact from mapbox gl native and not part of maplibre gl native
            getRemoteAsset(new URL(url).href, callback)
        },
    }

    return handler
}

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
const loadImage = async (map, id, { url, pixelRatio = 1, sdf = false }) => {
    if (!url) {
        const msg = `Invalid url for image: ${id}`
        logger.error(msg)
        throw new Error(msg)
    }

    try {
        let imgBuffer = null
        if (url.startsWith('data:')) {
            imgBuffer = Buffer.from(url.split('base64,')[1], 'base64')
        } else {
            const img = await getRemoteAssetPromise(url)
            imgBuffer = img.data
        }
        const img = sharp(imgBuffer)
        const metadata = await img.metadata()
        const data = await img.raw().toBuffer()
        await map.addImage(id, data, {
            width: metadata.width,
            height: metadata.height,
            pixelRatio,
            sdf,
        })
    } catch (e) {
        const msg = `Error loading icon image: ${id}\n${e}`
        logger.error(msg)
        throw new Error(msg)
    }
}

/**
 * Load all icon images to the map.
 *
 * @param {object} map - Mapbox GL map object
 * @param {object} images - Object with {id: {url, ...other image properties}}
 */
const loadImages = async (map, images) => {
    if (images !== null) {
        const imageRequests = Object.entries(images).map(async (image) => {
            await loadImage(map, ...image)
        })

        // await for all requests to complete
        await Promise.all(imageRequests)
    }
}

/**
 * Render the map, returning a Promise.
 *
 * @param {object} map - Mapbox GL map object
 * @param {object} options - Mapbox GL map options
 */
const renderMap = (map, options) => {
    return new Promise((resolve, reject) => {
        map.render(options, (err, buffer) => {
            if (err) {
                return reject(err)
            }
            return resolve(buffer)
        })
    })
}

/**
 * Convert premultiplied image buffer from Mapbox GL to RGBA PNG format.
 *
 * @param {Uint8Array} buffer - Image data buffer
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number} ratio - Image pixel ratio
 */
const toPNG = async (buffer, width, height, ratio) => {
    // Un-premultiply pixel values
    // Mapbox GL buffer contains premultiplied values, which are not handled correctly by sharp
    // https://github.com/mapbox/mapbox-gl-native/issues/9124
    // since we are dealing with 8-bit RGBA values, normalize alpha onto 0-255 scale and divide
    // it out of RGB values

    for (let i = 0; i < buffer.length; i += 4) {
        const alpha = buffer[i + 3]
        const norm = alpha / 255
        if (alpha === 0) {
            buffer[i] = 0
            buffer[i + 1] = 0
            buffer[i + 2] = 0
        } else {
            buffer[i] /= norm
            buffer[i + 1] = buffer[i + 1] / norm
            buffer[i + 2] = buffer[i + 2] / norm
        }
    }

    return sharp(buffer, {
        raw: {
            width: width * ratio,
            height: height * ratio,
            channels: 4,
        },
    })
        .png()
        .toBuffer()
}

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
export const render = async (
    style,
    width = 1024,
    height = 1024,
    // @ts-ignore because switching order may break stuff
    options,
    requestHandler
) => {
    const {
        bounds = null,
        bearing = 0,
        pitch = 0,
        token = null,
        ratio = 1,
        padding = 0,
        images = null,
    } = options
    let { center = null, zoom = null, tilePath = null } = options

    if (!style) {
        const msg = 'style is a required parameter'
        throw new Error(msg)
    }
    if (!(width && height)) {
        const msg =
            'width and height are required parameters and must be non-zero'
        throw new Error(msg)
    }

    if (center !== null) {
        if (center.length !== 2) {
            const msg = `Center must be longitude,latitude.  Invalid value found: ${[
                ...center,
            ]}`
            throw new Error(msg)
        }

        if (Math.abs(center[0]) > 180) {
            const msg = `Center longitude is outside world bounds (-180 to 180 deg): ${center[0]}`
            throw new Error(msg)
        }

        if (Math.abs(center[1]) > 90) {
            const msg = `Center latitude is outside world bounds (-90 to 90 deg): ${center[1]}`
            throw new Error(msg)
        }
    }

    if (zoom !== null && (zoom < 0 || zoom > 22)) {
        const msg = `Zoom level is outside supported range (0-22): ${zoom}`
        throw new Error(msg)
    }

    if (bearing !== null && (bearing < 0 || bearing > 360)) {
        const msg = `bearing is outside supported range (0-360): ${bearing}`
        throw new Error(msg)
    }

    if (pitch !== null && (pitch < 0 || pitch > 60)) {
        const msg = `pitch is outside supported range (0-60): ${pitch}`
        throw new Error(msg)
    }

    if (bounds !== null) {
        if (bounds.length !== 4) {
            const msg = `Bounds must be west,south,east,north.  Invalid value found: ${[
                ...bounds,
            ]}`
            throw new Error(msg)
        }

        if (padding) {
            // padding must not be greater than width / 2 and height / 2
            if (Math.abs(padding) >= width / 2) {
                throw new Error('Padding must be less than width / 2')
            }
            if (Math.abs(padding) >= height / 2) {
                throw new Error('Padding must be less than height / 2')
            }
        }
    }

    // calculate zoom and center from bounds and image dimensions
    if (bounds !== null && (zoom === null || center === null)) {
        const viewport = geoViewport.viewport(
            bounds,
            // add padding to width and height to effectively
            // zoom out the target zoom level.
            [width - 2 * padding, height - 2 * padding],
            undefined,
            undefined,
            undefined,
            true
        )
        zoom = Math.max(viewport.zoom - 1, 0)
        /* eslint-disable prefer-destructuring */
        center = viewport.center
    }

    // validate that all local mbtiles referenced in style are
    // present in tilePath and that tilePath is not null
    if (tilePath) {
        tilePath = path.normalize(tilePath)
    }

    const localMbtilesMatches = JSON.stringify(style).match(MBTILES_REGEXP)
    if (localMbtilesMatches && !tilePath) {
        const msg =
            'Style has local mbtiles file sources, but no tilePath is set'
        throw new Error(msg)
    }

    if (localMbtilesMatches && tilePath) {
        localMbtilesMatches.forEach((name) => {
            const mbtileFilename = path.normalize(
                path.format({
                    dir: tilePath,
                    name: name.split('://')[1],
                    ext: '.mbtiles',
                })
            )
            if (!fs.existsSync(mbtileFilename)) {
                const msg = `Mbtiles file ${path.format({
                    name,
                    ext: '.mbtiles',
                })} in style file is not found in: ${path.resolve(tilePath)}`
                throw new Error(msg)
            }
        })
    }

    const map = new maplibre.Map({
        request: ({ url, kind }, callback) => {
            const isMapbox = isMapboxURL(url)
            if (isMapbox && !token) {
                const msg = 'mapbox access token is required'
                logger.error(msg)
                return callback(new Error(msg))
            }

            const handler = {
                ...getDefaultRequestHandler(tilePath, token),
                ...requestHandler,
            }

            /** @type {RequestFn | undefined} */
            const requestFn = handler[kind]

            try {
                if (!requestFn) {
                    // NOT HANDLED!
                    const msg = `error Request kind not handled: ${kind}`
                    logger.error(msg)
                    throw new Error(msg)
                }
                requestFn(url, callback)
            } catch (err) {
                const msg = `Error while making resource request to: ${url}\n${err}`
                logger.error(msg)
                return callback(new Error(msg))
            }
        },
        ratio,
    })

    map.load(style)

    await loadImages(map, images)

    const buffer = await renderMap(map, {
        zoom,
        center,
        height,
        width,
        bearing,
        pitch,
    })

    return toPNG(buffer, width, height, ratio)
}

export default render
