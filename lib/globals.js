import chalk from 'chalk';

export const print = (type, ...args) => {
    const time = chalk.yellowBright(new Date().toLocaleTimeString());

    switch (type) {
        case 'info':
            return console.log(`[${time}] ${chalk.blueBright('[INFO]')}`, ...args);
        case 'warn':
            return console.log(`[${time}] ${chalk.yellowBright('[WARN]')}`, ...args);
        case 'error':
            return console.log(`[${time}] ${chalk.redBright('[ERROR]')}`, ...args);
        case 'success':
            return console.log(`[${time}] ${chalk.greenBright('[SUCCESS]')}`, ...args);
        case 'debug':
            if (!global.printDebug) return;
            return console.log(`[${time}] ${chalk.gray('[DEBUG]')}`, ...args);
    }
}
export const loop = async (func, interval) => {
    while (true) {
        await func();
        await sleep(interval);
    }
};
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export const EMBED_COLORS = {
    INFO: 0x00bfff,
    WARN: 0xfff873,
    ERROR: 0xff7373,
    SUCCESS: 0x8cff73,
    DEBUG: 0x808080,
    PRIMARY: 0xe175ff
}
export const EMOJIS = {
    LOADING: '<a:loading:975978497321361409>',
}
