WebSocket = require('ws');
const fetch = require('node-fetch');

const LISTENING = "SelfToken";
const CLAIMMERS = 'SelfToken';
const GUILDIDS = 'ServerID';

let socket = null;
let heartbeatInterval = null;

const guilds = {};

const measureURLFetchTime = async (vanityURL) => { 
    const start = Date.now();
    const baseUrls = [
        
        'https://canary.discord.com/api/v8',
        

    ];

    for (const baseUrl of baseUrls) {
        for (let i = 0; i < 3; i++) {
            await fetch(`${baseUrl}/guilds/${GUILDIDS}/vanity-url`, {
                method: 'PATCH',
                headers: {
                    Authorization: `${CLAIMMERS}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ code: vanityURL })
            });
        }
    }

    const end = Date.now();
    const elapsed = end - start;
    const elapsedMilliseconds = (elapsed / 1000).toFixed(2); 
    return elapsedMilliseconds;
};

const claimVanityURL = async (vanityURL, guildId, event) => {
    const fetchTime = await measureURLFetchTime(vanityURL);
    console.log(`Url başarılı şekilde çekildi : [ ${vanityURL} ] ${fetchTime} ms.`);
};


const updateGuildListAndSendInfo = (guildData, action) => {
    if (guildData.id) {
        guilds[guildData.id] = { vanity_url_code: guildData.vanity_url_code };
    }
    const vanities = Object.values(guilds).map(g => g.vanity_url_code).filter(v => v);
    for (let i = 0; i < vanities.length; i += 10) {
        console.log(vanities.slice(i, i + 10).join(" "));
    }
};

//anlamazsanız ya da hata alırsanız discorddan ulaşın - isovich 

const onMessage = async (message) => {
    const data = JSON.parse(message);

    if (data.op === 10) {
        heartbeatInterval = setInterval(() => {
            socket.send(JSON.stringify({ op: 0, d: null }));
        }, data.d.heartbeat_interval);

        socket.send(JSON.stringify({
            op: 2,
            d: {
                token: LISTENING,
                properties: {
                    $os: 'linux',
                    $browser: 'my_bot',
                    $device: 'my_bot'
                },
                intents: 513
            }
        }));
    } else if (data.op === 0) { // DISPATCH
        if (data.t === "GUILD_UPDATE" || data.t === "GUILD_AUDIT_LOG_ENTRY_CREATE" || data.t === "GUILD_DELETE") {
            const oldVanity = guilds[data.d.id] ? guilds[data.d.id].vanity_url_code : null;
            guilds[data.d.id] = { vanity_url_code: data.d.vanity_url_code };

            if (oldVanity && oldVanity !== data.d.vanity_url_code) {
                claimVanityURL(oldVanity, data.d.id, 'GUILD_UPDATE');
            }

            if (oldVanity && oldVanity !== data.d.vanity_url_code) {
                claimVanityURL(oldVanity, data.d.id, 'GUILD_AUDIT_LOG_ENTRY_CREATE');
            }

        } else if (data.t === "GUILD_CREATE" || data.t === "GUILD_DELETE") {
            updateGuildListAndSendInfo(data.d, data.t);
        } else if (data.t === "READY") {
            data.d.guilds.forEach(guild => {
                if (guild.vanity_url_code) {
                    guilds[guild.id] = { vanity_url_code: guild.vanity_url_code };
                }
            });
            const vanities = Object.values(guilds).map(g => g.vanity_url_code).filter(v => v);
            for (let i = 0; i < vanities.length; i += 10) {
                console.log(vanities.slice(i, i + 10).join(" "));
            }
        }
    }
};
//discord.gg/1743
const connectToWebSocket = () => {
    socket = new WebSocket('wss://gateway-us-east1-c.discord.gg');

    socket.on('open', () => {
        console.log('Connected to Discord WebSocket Gateway.');
    });

    socket.on('message', onMessage);

    socket.on('close', () => {
        console.log('WebSocket connection closed. Reconnecting...');
        clearInterval(heartbeatInterval);
        setTimeout(connectToWebSocket, 1000);
    });

    socket.on('error', (error) => {
        console.error('WebSocket encountered an error:', error);
        clearInterval(heartbeatInterval);
    });
};

connectToWebSocket();