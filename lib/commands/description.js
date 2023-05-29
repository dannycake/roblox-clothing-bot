import * as Roblox from '../roblox.js';

import {EmbedBuilder} from 'discord.js';
import {EMBED_COLORS} from '../globals.js';

export const name = 'description';
export const description = 'generates the description from an item name';

export const options = [{
    name: 'name',
    description: 'the name of the item',
    type: 'String',
    required: true
}];

export const execute = async (client, message, args) => {
    const itemName = args.join(' ');

    const description = Roblox.generateDescription(itemName);

    return message.channel.send({
        embeds: [
            new EmbedBuilder()
                .setColor(EMBED_COLORS.PRIMARY)
                .setTitle(`:star: Generated description for "${itemName}"`)
                .setDescription(description)
        ]
    });
};
