import fs from 'fs';
import crypto from 'crypto';
import superagent from 'superagent';
import jimp from 'jimp';

import {print} from './globals.js';

const watermark = await jimp.read('./config/assets/overlay.png');
const hashes = {};

try {
    const fileHashes = fs.readFileSync('./config/data/hashes.txt', 'utf8')
        .trim()
        .replace(/\r/g, '')
        .split('\n')
        .filter(line => line.length);

    for (const line of fileHashes) {
        const [id, hash] = line.split(':');
        hashes[id] = hash;
    }
} catch (e) {
    print('info', 'No hashes.txt file found, creating one...');
    fs.writeFileSync('./config/data/hashes.txt', '0:abcdef');
}
const writeHashes = () => {
    const hashData = Object.entries(hashes)
        .map(([id, hash]) => `${id}:${hash}`)
        .join('\n');

    fs.writeFileSync('./config/data/hashes.txt', hashData);
}

/**
 * Gets the hash of an asset by its ID
 * @param id{number} asset id
 * @returns {Buffer | null} asset hash
 */
export const getHash = id => {
    if (!hashes[id]) return null;
    return hashes[id];
}

/**
 * Gets the ID of an asset by its hash
 * @param hash{String} asset hash
 * @returns {String | null} asset id
 */
export const findHash = hash => {
    for (const [id, h] of Object.entries(hashes))
        if (h === hash) return id;
    return null;
}

const fetchInitialXML = id => new Promise(resolve => {
    superagent('GET', 'https://assetdelivery.roblox.com/v1/asset/')
        .query({
            id
        })
        .buffer(true)
        .accept('png')
        .then(resp => {
            return resolve(resp.text);
        })
        .catch(error => {
            print('error',
                `Failed to fetch initial XML for asset "${id}":`,
                error.response ? error.response.body : error.message
            );
            return resolve();
        });
});

const fetchRawAssetData = id => new Promise(resolve => {
    fetch(`https://assetdelivery.roblox.com/v1/asset/?id=${id}`, {
        method: 'GET',
    })
        .then(async resp => {
            const reader = resp.body.getReader();
            const data = [];

            while (true) {
                const {done, value} = await reader.read();
                if (done) break;
                data.push(value);
            }

            resolve(Buffer.concat(data));
        })
        .catch(error => {
            print('error',
                `Failed to fetch raw asset data for asset "${id}":`,
                error.message
            );
            resolve();
        });
});

/**
 * Fetches the asset image for the given asset ID
 * @param id{number} asset id
 * @returns {Promise<Buffer | null>} asset image
 */
const fetchAssetData = id => new Promise(async resolve => {
    try {
        const assetXML = await fetchInitialXML(id);
        if (!assetXML) return resolve();

        const idMatch = assetXML.match(/\/asset\/\?id=(\d+)</);
        const assetDataId = idMatch[1];

        const finalAssetData = await fetchRawAssetData(assetDataId);
        return resolve(finalAssetData);
    } catch (error) {
        print('error', `Failed to fetch asset data for asset "${id}":`, error.message);
        return resolve();
    }
});

/**
 * Fetches the asset buffer for the given asset ID
 * @param id{number} asset ID
 * @returns {Promise<Buffer>} asset buffer
 */
export const fetchAsset = id => new Promise(async resolve => {
    const rawAssetData = await fetchAssetData(id);
    if (!rawAssetData) return resolve();

    const data = [];
    data.push(rawAssetData);

    resolve(Buffer.concat(data));
});

/**
 * Overlays the watermark onto the given image buffer
 * @param buffer{Buffer} image buffer
 * @returns {Promise<Buffer>} image buffer with watermark
 */
export const overlayWatermark = async buffer => {
    const image = await jimp.read(buffer);

    // removes slightly transparent black pixels and replace them with barely visible white
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, (x, y, idx) => {
        const r = image.bitmap.data[idx];
        const g = image.bitmap.data[idx + 1];
        const b = image.bitmap.data[idx + 2];
        const a = image.bitmap.data[idx + 3];

        if (/*r <= 25 && g <= 25 && b <= 25 &&*/ a < 250) {
            image.bitmap.data[idx + 0] = 255;
            image.bitmap.data[idx + 1] = 255;
            image.bitmap.data[idx + 2] = 255;
            image.bitmap.data[idx + 3] = 1;
        }
    });

    image.composite(watermark, 0, 0, {
        mode: jimp.BLEND_SOURCE_OVER,
        opacityDest: 1,
        opacitySource: 1
    });

    return await image.getBufferAsync(jimp.MIME_PNG);
}

/**
 * fetches the asset buffer for the given asset ID and overlays the watermark onto it
 * @param id{number} asset id
 * @returns {Promise<Buffer | null>} image buffer with watermark
 */
export const fetchAssetWithWatermark = async id => {
    const assetBuffer = await fetchAsset(id);
    if (!assetBuffer) return null;

    return await overlayWatermark(assetBuffer);
}

/**
 * Hashes the given buffer to a sha256 hash
 * @param buffer{Buffer} buffer to hash
 * @returns {String} sha256 hash
 */
export const hashBuffer = buffer =>
    crypto.createHash('sha256')
        .update(buffer)
        .digest('hex');

/**
 * Hashes the given asset buffer and saves the hash to the hashes.txt file
 * @param id{number} asset id
 * @param buffer{Buffer} asset buffer
 * @returns {String} sha256 hash
 */
export const hashAssetBuffer = (id, buffer) => {
    const hash = hashBuffer(buffer);
    hashes[id] = hash;
    writeHashes();
    // print('debug', `Hashed asset "${id}" to "${hash}"`)
    return hash;
}
