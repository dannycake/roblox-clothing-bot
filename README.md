# Roblox Clothing Bot

## 🌟 Features
- Changes template of clothing automatically
- Uploads clothing to Roblox
- Mass set clothing price / description
- Notifies in Discord of sales
- Checks for duplicate clothing
---
## 📩 Installation
1. Install [Node.js](https://nodejs.org/en/download/) (LTS/Latest works fine)
2. Download the latest bot files and extract them
3. Open a terminal in the bot folder and run `npm install`
4. Fill in `config/config.toml` with your bot's required information
5. Modify `config/assets/overlay.png` to fit your group
6. Run the bot with `node index.js`
7. Invite the bot to your Discord server using the link in the console
8. View the bot's commands with `!help` in Discord
---
## 📋 Configuration
Most options are pretty self-explanatory
```toml
[setup]
# The owner's cookie
# Only used for payouts, do not use main account
group_owner_cookie = 'cookie with payout perms in the group'
# The shirt uploader's cookie
# Highly likely to get banned, do not use main account
group_uploader_cookie = 'cookie with upload perms in the group'
# Group ID to manage
group_id = 123123123

[clothing]
# Default price to set new assets to
default_price = 7

# Include similar assets in the description
include_similar_items = true
# Max amount of similar items to incluide
similar_items_limit = 5

[discord]
# Discord bot token (https://discord.com/developers/applications)
bot_token = 'abcde.fghijk.lmnopq'
# Prefix used for command, e.g. !help
bot_prefix = '!'
# Whitelisted user IDs that can use the bot
whitelisted_users = [
    '123123123123123'
]

# Channel ID to send sale notifications to
sale_notifications_channel = '123123123123123'

[logging]
# Print messages marked by [DEBUG]
print_debug = true
```
