import * as path from 'path';
import fs from 'fs';
import FormData from 'form-data';
import Fuse from 'fuse.js';
import superagent from 'superagent';

import config from './config.js';
import * as Assets from './assets.js';
import {print, sleep} from './globals.js';

const {
    setup: {
        'group_owner_cookie': ownerCookie,
        'group_uploader_cookie': uploaderCookie,
        'group_id': groupId,
    },
    clothing: {
        'default_price': defaultPrice,
        'include_similar_items': includeSimilarItems,
        'similar_items_limit': similarItemsLimit,
    }
} = config;
let groupName = 'Unknown';

const groupAssets = {};

export const findGroupAssetByName = name => Object.values(groupAssets).find(asset => asset.name === name);

class Account {
    cookie;
    csrf;
    agent;
    id;
    username;

    constructor(cookie) {
        this.cookie = cookie;
        this.csrf = 'abcdefg';
        this.agent = superagent.agent()
            .set('Cookie', `.ROBLOSECURITY=${this.cookie}`);
    }

    async getDetails() {
        return new Promise(resolve => {
            this.agent.get('https://www.roblox.com/my/settings/json')
                .then(resp => {
                    if (!Object.keys(resp.body).length) {
                        return resolve(false);
                    }

                    this.id = resp.body.UserId;
                    this.username = resp.body.Name;
                    print('success', `Successfully logged in as "${this.username}" (${this.id})`);
                    resolve(true);
                })
                .catch(error => {
                    print('error', 'Failed to get account details:', error.response ? error.response.data : error.message);
                    resolve(false);
                });
        })
    }

    /**
     * Gets the robux balance of the account
     * @returns {Promise<Number | null>} robux balance
     */
    async getRobux() {
        return new Promise(resolve => {
            this.agent.get(`https://economy.roblox.com/v1/users/${this.id}/currency`)
                .then(resp => {
                    resolve(resp.body.robux);
                })
                .catch(error => {
                    print('error', `Failed to get "${this.username}"'s robux balance:`, error.response ? error.response.data : error.message);
                    resolve(null);
                });
        })
    }

    /**
     * Gets the role of the account in the group (if any)
     * @returns {Promise<Number | null>} role rank
     */
    async inPrimaryGroup() {
        return new Promise(resolve => {
            this.agent.get(`https://groups.roblox.com/v1/users/${this.id}/groups/roles`)
                .then(resp => {
                    const group = resp.body.data.find(group => group.group.id === groupId);
                    if (!group) {
                        return resolve(false);
                    }

                    groupName = group.group.name;

                    resolve(group.role.rank);
                })
                .catch(error => {
                    print('error', `Failed to get "${this.username}"'s role in group:`, error.response ? error.response.data : error.message);
                    resolve(null);
                });
        })
    }
}

const ownerAccount = new Account(ownerCookie);
const uploaderAccount = new Account(uploaderCookie);

export const getAccounts = () => ({
    owner: ownerAccount,
    uploader: uploaderAccount
})

const description = fs.readFileSync(
    path.join(
        process.cwd(), 'config', 'assets', 'description.txt'), 'utf8'
).trim().replace(/\r/g, '').replace(/\n/g, '\r\n');

let lastSaleId;
export const getGroupSales = async () => new Promise(resolve => {
    print('debug', 'Fetching group sales...')
    ownerAccount.agent.get(`https://economy.roblox.com/v2/groups/${groupId}/transactions`)
        .query({
            cursor: '',
            limit: 100,
            transactionType: 'Sale',
        })
        .set('content-type', 'application/json')
        .then(resp => {
            const {data, nextPageCursor} = resp.body;

            if (!lastSaleId) {
                lastSaleId = data[0].id;
                print('debug', `no previously cached sales, setting sale id to "${lastSaleId}"`); // temp debug

                print('debug', `Fetched ${data.length} sales, with no new sales.`);
                return resolve([]);
            }

            let newSales = [];
            for (const sale of data) {
                if (sale.id <= lastSaleId) {
                    console.log(sale, `latest sale of "${sale.id}" is less than cached "${lastSaleId}"`); // temp debug
                    lastSaleId = data[0].id;

                    break;
                }

                const {
                    agent: {
                        id: agentId,
                        name: agentName,
                    },
                    details: {
                        id: assetId,
                        name: assetName,
                        type: assetType,
                    },
                    currency: {
                        amount
                    },
                } = sale;

                // Ignore non-asset sales
                if (assetType !== 'Asset') continue;

                print('info', `Found new sale: ${assetName} (${assetId}) for ${amount} robux by ${agentName} (${agentId})`);
                newSales.push({
                    assetId,
                    assetName,

                    agentId,
                    agentName,

                    amount,
                });
            }

            print('debug', `Found ${data.length} sales, with ${newSales.length} new sales.`);
            resolve(newSales);
        })
        .catch(error => {
            print('error', `Failed to get group sales:`, error.response ? error.response.data : error.message);
            resolve([]);
        });
});

export const validateAccounts = async () => {
    const ownerStatus = await ownerAccount.getDetails();
    const uploaderStatus = await uploaderAccount.getDetails();

    if (!ownerStatus || !uploaderStatus) {
        if (!ownerStatus)
            print('error', `An invalid owner cookie was provided.`);
        if (!uploaderStatus)
            print('error', `An invalid uploader cookie was provided.`);

        print('info', `Please provide valid cookies in the config.toml file before relaunching.`);
        return process.exit(1);
    }

    const ownerInGroup = await ownerAccount.inPrimaryGroup();
    const uploaderInGroup = await uploaderAccount.inPrimaryGroup();
    if (!ownerInGroup || !uploaderInGroup) {
        if (!ownerInGroup)
            print('error', `The owner account is not in the group id provided.`);
        if (!uploaderInGroup)
            print('error', `The uploader account is not in the group id provided.`);

        print('info', `Please ensure that the owner and uploader accounts are in the primary group before relaunching.`);
        return process.exit(1);
    }

    if (ownerInGroup !== 255) {
        print('error', `The owner account does not have the correct permissions in the group id provided.`);
        print('info', `Please ensure that the owner account has the correct permissions before relaunching.`);
        return process.exit(1);
    }

    print('debug', 'Successfully validated all accounts');
    print('success', `Overseeing group "${groupName}" (${groupId})`);
};

export const generateDescription = (assetName, assetId = 1) => {
    let generatedDescription = description;

    const fuse = new Fuse(Object.values(groupAssets), {
        keys: ['name'],
        threshold: 1,
    });

    const results = fuse.search(assetName);
    const similarItems = results
        .filter(result => result.item.id !== assetId)
        .slice(0, similarItemsLimit)
        .map(result => `https://roblox.com/catalog/${result.item.id}`);

    if (includeSimilarItems && similarItems.length)
        generatedDescription = generatedDescription.replace(/\{similarItems}/g, similarItems.join('\n'));
    else
        generatedDescription = generatedDescription.replace(/\{similarItems}/g, '');

    return generatedDescription;
}

export const getGroupAssets = async (groupName, cursor = '', previousData = []) => new Promise(resolve => {
    superagent('GET', `https://catalog.roblox.com/v1/search/items`)
        .query({
            category: 'Clothing',
            creatorName: groupName,
            creatorType: 'Group',
            limit: 120,
            salesTypeFilter: 1,
            subcategory: 'Clothing',
            cursor
        })
        .set('content-type', 'application/json')
        .then(async resp => {
            const {data, nextPageCursor} = resp.body;

            if (nextPageCursor) {
                print('debug', `Found ${data.length} assets in group "${groupName}", fetching next page (${nextPageCursor})...`);
                await sleep(5 * 1000);
                return getGroupAssets(groupName, nextPageCursor, [...previousData, ...data]).then(resolve);
            }

            const finalData = [...previousData, ...data];

            print('debug', `Found ${finalData.length} assets in group "${groupName}"`);
            resolve(finalData);
        })
        .catch(async error => {
            if (
                error.response &&
                error.response?.text.includes('InternalServerError') ||
                error.response?.text.includes('Too many requests')
            ) {
                print('error', `Ratelimited while retrieving clothing:`, error.response ? error.response.body : error);
                await sleep(10 * 1000);
                return getGroupAssets(groupName, cursor, previousData).then(resolve);
            }

            print('error', `Failed to get group assets:`, error.response ? error.response.body : error);
            resolve(previousData);
        });
});

let globalCSRF = 'abcdefg'
export const getGroupAssetsData = async ids => new Promise(resolve => {
    superagent('POST', `https://catalog.roblox.com/v1/catalog/items/details`)
        .send({
            items: ids.map(id => ({
                itemType: 1,
                id,
            })),
        })
        .set('x-csrf-token', globalCSRF)
        .set('content-type', 'application/json')
        .then(resp => {
            const {data} = resp.body;

            resolve(data);
        })
        .catch(async error => {
            if (error.response && error.response?.text.includes('Token Validation Failed')) {
                globalCSRF = error.response.headers['x-csrf-token'];
                return getGroupAssetsData(ids).then(resolve);
            }

            if (error.response && error.response?.text.includes('Too many requests')) {
                print('error', `Ratelimited while retrieving clothing data:`, error.response ? error.response.body : error)
                await sleep(10 * 1000);
                return getGroupAssetsData(ids).then(resolve);
            }

            print('error', `Failed to get group assets data:`, error.response ? error.response.body : error);
            resolve([]);
        });
});
export const getAssetData = async id => new Promise(resolve => {
    superagent('GET', `https://economy.roblox.com/v2/assets/${id}/details`)
        .set('content-type', 'application/json')
        .then(resp => {
            resolve(resp.body);
        })
        .catch(async error => {
            if (error.response && error.response?.text.includes('Too many requests')) {
                print('error', `Ratelimited while retrieving asset data:`, error.response ? error.response.body : error)
                await sleep(10 * 1000);
                return getAssetData(id).then(resolve);
            }

            print('error', `Failed to get asset data:`, error.response ? error.response.body : error);
            resolve(null);
        });
});

let updateGroupCacheInterval = setInterval(() => {
}, 1000 * 60 * 60 * 24 * 7);
export const refreshGroupAssets = async (force = false) => {
    print('info', `Collecting assets in group "${groupName}" (${groupId})...`);

    let assets;
    const groupCacheExists = fs.existsSync(path.join(process.cwd(), 'config', 'data', 'groupAssets.json'));

    if (groupCacheExists && !force) {
        const oldAssets = fs.readFileSync(path.join(process.cwd(), 'config', 'data', 'groupAssets.json'), 'utf8');
        assets = Object.values(JSON.parse(oldAssets)).map(asset => ({id: asset.id}));
    }

    if (!groupCacheExists || force) {
        print('debug', `Regenerating group asset cache...`)
        assets = await getGroupAssets(groupName);
    }

    print('success', `Collected ${assets.length} assets in group "${groupName}" (${groupId})`);
    print('info', `Hashing assets... this can take a while depending on the amount of assets in the group and if they have been hashed before`);

    let hashed = 0;

    for (const asset of assets) {
        hashed++;
        try {
            if (Assets.getHash(asset.id)) continue;
            const buffer = await Assets.fetchAssetWithWatermark(asset.id);
            if (!buffer) continue;

            print('debug', `Hashed asset ${asset.id} (${hashed.toLocaleString()}/${assets.length.toLocaleString()})`);

            Assets.hashAssetBuffer(asset.id, buffer);
        } catch (error) {
            print('error', `Failed to hash asset ${asset.id} (most likely deleted), skipping...`)
        }
    }

    print('debug', `Stored ${hashed.toLocaleString()} hashes for group "${groupName}" (${groupId})`);

    const chunked = [];
    for (let i = 0; i < assets.length; i += 100)
        chunked.push(assets.slice(i, i + 100));

    print('info', `Fetching asset data... this can take a while depending on the amount of assets in the group`);
    const data = [];
    for (const chunk of chunked) {
        const chunkData = await getGroupAssetsData(chunk.map(asset => asset.id));
        data.push(...chunkData);

        print('debug', `Fetched ${chunkData.length} assets (${data.length.toLocaleString()}/${assets.length.toLocaleString()})`);
    }

    print('success', `Fetched ${data.length} assets in group "${groupName}" (${groupId})`);
    for (const asset of data) {
        const {id, name, description, assetType, price} = asset;

        groupAssets[id] = {
            id,
            name,
            description,
            type: assetType,
            price,
        };
    }

    fs.writeFileSync(path.join(process.cwd(), 'config', 'data', 'groupAssets.json'), JSON.stringify(groupAssets, null, 4));

    clearInterval(updateGroupCacheInterval);
    updateGroupCacheInterval = setInterval(() => {
        fs.writeFileSync(path.join(process.cwd(), 'config', 'data', 'groupAssets.json'), JSON.stringify(groupAssets, null, 4));
    }, 1000 * 60);
};

/**
 * Updates an item's data on the website
 * @param id{number} asset id
 * @param data{object} data to update
 * @returns {Promise<boolean | null>}
 */
export const updateItem = async (id, data = {}) => new Promise(resolve => {
    uploaderAccount.agent.patch(`https://develop.roblox.com/v1/assets/${id}`)
        .set('x-csrf-token', uploaderAccount.csrf)
        .set('content-type', 'application/json')
        .send(data)
        .then(_resp => {
            groupAssets[id] = {
                ...groupAssets[id],
                ...data,
            };

            resolve(true);
        })
        .catch(async error => {
            if (error.response && error.response?.text.includes('Token Validation Failed')) {
                uploaderAccount.csrf = error.response.headers['x-csrf-token'];
                return updateItem(id, data).then(resolve);
            }

            if (error.response && error.response?.text.includes('Too many requests')) {
                print('error', `Ratelimited while updating item ${id}:`, error.response ? error.response.body : error)
                await sleep(10 * 1000);
                return updateItem(id, data).then(resolve);
            }

            print('error', `Failed to update item ${id}:`, error.response ? error.response.body : error);
            return resolve(false);
        });
});

/**
 * Updates an item's price on the website
 * @param id{number} asset id
 * @param price{number} price in robux
 * @returns {Promise<boolean>} whether or not the item was updated
 */
export const updateItemPrice = async (id, price = defaultPrice) => new Promise(resolve => {
    uploaderAccount.agent.post(`https://itemconfiguration.roblox.com/v1/assets/${id}/update-price`)
        .set('x-csrf-token', uploaderAccount.csrf)
        .set('content-type', 'application/json')
        .send({
            priceConfiguration: {
                priceInRobux: price
            }
        })
        .then(_resp => {
            groupAssets[id].price = price;

            resolve(true);
        })
        .catch(async error => {
            if (error.response && error.response?.text.includes('Token Validation Failed')) {
                uploaderAccount.csrf = error.response.headers['x-csrf-token'];
                return updateItemPrice(id, price).then(resolve);
            }

            if (error.response && error.response?.text.includes('Flood Limit Exceeded')) {
                print('error', `Ratelimited while updating item ${id} price:`, error.response ? error.response.body : error)
                await sleep(10 * 1000);
                return updateItemPrice(id, price).then(resolve);
            }

            print('error', `Failed to update item ${id} price:`, error.response ? error.response.body : error);
            return resolve(false);
        });
});

export const releaseItem = async (id) => new Promise(resolve => {
    uploaderAccount.agent.post(`https://itemconfiguration.roblox.com/v1/assets/${id}/release`)
        .set('x-csrf-token', uploaderAccount.csrf)
        .set('content-type', 'application/json')
        .send({
            priceConfiguration: {
                priceInRobux: defaultPrice
            },
            saleStatus: 'OnSale',
            releaseConfiguration: {
                saleAvailabilityLocations: ['Catalog', 'AllUniverses']
            }
        })
        .then(_resp => {
            groupAssets[id].price = defaultPrice;

            resolve(true);
        })
        .catch(async error => {
            if (error.response && error.response.headers['x-csrf-token']) {
                uploaderAccount.csrf = error.response.headers['x-csrf-token'];
                return releaseItem(id).then(resolve);
            }

            if (error.response && error.response?.text.includes('Too many requests')) {
                print('error', `Ratelimited while releasing item ${id}:`, error.response ? error.response.body : error)
                await sleep(10 * 1000);
                return releaseItem(id).then(resolve);
            }

            print('error', `Failed to release item ${id}:`, error.response ? error.response.body : error);
            return resolve(false);
        });
});

/**
 * Updates all assets in the group to the specified price
 * @param newPrice{number} price in robux
 * @returns {Promise<void>}
 */
export const updateAllAssetsPrice = async (newPrice = defaultPrice) => {
    for (const asset of Object.values(groupAssets)) {
        if (asset.price === newPrice) continue;
        await updateItemPrice(asset.id, newPrice);
        print('debug', `Updated item ${asset.id} price to ${newPrice} robux`);

        await sleep(2 * 1000);
    }
};

export const updateAllDescriptions = async () => {
    for (const asset of Object.values(groupAssets)) {
        const generatedDescription = generateDescription(asset.name, asset.id);
        if (asset.description === generatedDescription) continue;

        await updateItem(asset.id, {
            description: generatedDescription
        });

        await sleep(4 * 1000);
    }
};

export const getTotalRevenue = async () => new Promise(resolve => {
    ownerAccount.agent.get(`https://economy.roblox.com/v1/groups/${groupId}/revenue/summary/year`)
        .then(resp => {
            resolve(resp.body ?? null);
        })
        .catch(error => {
            print('error', `Failed to get total revenue:`, error.response ? error.response.body : error);
            resolve(null);
        })
});

export const getAssetRevision = (operationId) => new Promise(resolve => {
    uploaderAccount.agent.get(`https://apis.roblox.com/assets/user-auth/v1/operations/${operationId}`)
        .set('content-type', 'application/json')
        .then(resp => {
            resolve(resp.body.response ?? null);
        })
        .catch(error => {
            print('error', `Failed to get asset revision:`, error.response ? error.response.text : error);
            resolve(null);
        })
});

export const uploadAsset = async (name, type = 11, buffer) => new Promise(resolve => {
    const form = new FormData();

    const description = generateDescription(name);

    form.append('request', Buffer.from(JSON.stringify({
        displayName: name,
        description,
        assetType: type === 11 ? 'Shirt' : 'Pants',
        creationContext: {
            creator: {
                groupId
            },
            expectedPrice: 10
        }
    })));
    form.append('fileContent', buffer, 'asset.png');

    uploaderAccount.agent.post(`https://apis.roblox.com/assets/user-auth/v1/assets`)
        .set('content-type', form.getHeaders()['content-type'])
        .set('x-csrf-token', uploaderAccount.csrf)
        .send(form.getBuffer())
        .then(async resp => {
            // fetch asset details from roblox and make sure it wasn't moderated
            let revision;
            for (let i = 0; i < 5; i++) {
                revision = await getAssetRevision(resp.body.operationId);
                if (revision) break;

                print('debug', 'Attempting to grab current asset revision...');

                await sleep(5 * 1000);
            }

            if (!revision) return resolve({
                error: 'Failed to get asset revisions',
                id: null,
            });

            if (revision?.moderationResult?.moderationState !== 'Approved') return resolve({
                error: 'Asset was moderated',
                id: null,
            });

            let {assetId: id} = revision;
            id = parseInt(id);

            print('debug', `Uploaded asset ${name} (${id})`);

            groupAssets[id] = {
                id,
                name,
                description,
                type,
                price: defaultPrice,
            }

            releaseItem(id);

            Assets.hashAssetBuffer(id, buffer);

            resolve({
                success: true,
                id,
            });
        })
        .catch(async error => {
            if (error.response && error.response.headers['x-csrf-token']) {
                uploaderAccount.csrf = error.response.headers['x-csrf-token'];
                return uploadAsset(name, type, buffer).then(resolve);
            }

            if (error.response && error.response?.text.includes('Too many requests')) {
                print('error', `Ratelimited while uploading asset "${name}":`, error.response ? error.response.body : error)
                await sleep(10 * 1000);
                return uploadAsset(name, type, buffer).then(resolve);
            }

            print('error', `Failed to upload asset "${name}":`, error.response ? error.response.body : error);
            return resolve({
                error: error.response ? error.response.body : error,
                id: null,
            });
        });
});

export const payoutRobux = async (receiverId, amount) => new Promise(resolve => {
    ownerAccount.agent.post(`https://groups.roblox.com/v1/groups/${groupId}/payouts`)
        .set('x-csrf-token', ownerAccount.csrf)
        .set('content-type', 'application/json')
        .send({
            PayoutType: 'FixedAmount',
            Recipients: [{
                recipientId: receiverId,
                recipientType: 'User',
                amount
            }]
        })
        .then(_resp => {
            resolve({
                success: true,
            });
        })
        .catch(async error => {
            if (error.response && error.response.headers['x-csrf-token']) {
                ownerAccount.csrf = error.response.headers['x-csrf-token'];
                return payoutRobux(receiverId, amount).then(resolve);
            }

            print('error', `Failed to pay out ${amount} robux to ${receiverId}:`, error.response ? error.response.body : error);
            return resolve({
                error: error.response ? error.response.body : error,
            });
        });
});

export const getPopularItems = async (type = 11, limit = 120, cursor = '', previousData = []) => new Promise(resolve => {
    superagent('GET', `https://catalog.roblox.com/v1/search/items`)
        .set('content-type', 'application/json')
        .query({
            category: 'Clothing',
            limit: 120,
            minPrice: 1,
            salesTypeFilter: 1,
            // sortAggregation: 3,
            // sortType: 2,
            subcategory: type === 11 ? 'ClassicShirts' : 'ClassicPants',
            cursor,
        })
        .then(resp => {
            const {data, nextCursor} = resp.body;

            const newData = [...previousData, ...data];

            if (nextCursor && newData.length < limit) {
                return getPopularItems(type, limit, nextCursor, newData).then(resolve);
            }

            resolve(newData);
        })
        .catch(async error => {
            if (
                error.response &&
                error.response?.text.includes('InternalServerError') ||
                error.response?.text.includes('Too many requests')
            ) {
                print('error', `Ratelimited while retrieving popular assets:`, error.response ? error.response.body : error);
                await sleep(10 * 1000);
                return getPopularItems(type, limit, cursor, previousData).then(resolve);
            }

            print('error', `Failed to get popular assets:`, error.response ? error.response.body : error);
            resolve([]);
        });
});
