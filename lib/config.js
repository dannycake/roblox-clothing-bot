import toml from 'toml';
import fs from 'fs';

const config = toml.parse(fs.readFileSync('./config/config.toml', 'utf8'));

// TODO: Add a check to make sure the config file options are valid

export default config;
