import {EmbedBuilder} from 'discord.js';
import {EMBED_COLORS} from '../globals.js';

export const name = 'help'
export const description = 'shows a list of all commands'

export const options = []

export const execute = async (client, message, _args) => {
    const commands = [];

    for (const command of client.commands.values()) {
        commands.push({
            name: command.name,
            description: command.description,
            options: command.options
        })
    }

    return message.reply({
        embeds: [
            new EmbedBuilder()
                .setTitle('all commands available')
                .setColor(EMBED_COLORS.PRIMARY)
                .setDescription(commands.map(command => {
                    return `\`${command.name}\` - ${command.description}`
                }).join('\n'))
        ]
    })
}
