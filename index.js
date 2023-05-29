/**
 * roblox cLothing bot
 * by danny ( https://danny.ink/ )
 *
 * reusable without permission or credit
 */

import * as Discord from './lib/discord.js';
import * as Roblox from './lib/roblox.js';

import {loop, print} from './lib/globals.js';
import config from './lib/config.js';

const {
    'logging': {
        'print_debug': printDebug,
    }
} = config;

if (printDebug) global.printDebug = true;

print('debug', `Starting up...`);

await Roblox.validateAccounts();
await Roblox.refreshGroupAssets();

await Discord.start();

loop(async () => {
    const newSales = await Roblox.getGroupSales();

    for (const sale of newSales)
        Discord.sendSaleNotification(sale);
}, 1000 * 60 * 5);
