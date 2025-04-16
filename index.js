const express = require('express');
const fs = require('fs');
let router = express.Router()
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser
} = require("@whiskeysockets/baileys");
const { upload } = require('./megajs/megajs');

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    let num = req.query.number;
    async function Socket() {
        const { state, saveCreds } = await useMultiFileAuthState(`./session`);
        try {
            let Socket = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.macOS("Safari"),
            });

            if (!Socket.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                const code = await Socket.requestPairingCode(num);
                if (!res.headersSent) {
                    await res.send({ code });
                }
            }

            Socket.ev.on('creds.update', saveCreds);
            Socket.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;
                if (connection === "open") {
                    try {
                        await delay(10000);
                        var ses = fs.readFileSync('./session/creds.json');
                        const auth_path = './session/';
                        const ctx = jidNormalizedUser(Socket.user.id);
                        const mega_url = await upload(fs.createReadStream(auth_path + 'creds.json'), `${ctx}.json`);
                        const str = mega_url.replace('https://mega.nz/file/', '');
                        const sid = `xatsral~${str}`;
                        const dt = await Socket.sendMessage(ctx, {
                            text: sid
                        });

                    } catch (e) {
                        
                    }

                    await delay(100);
                    return await removeFile('./session');
                    process.exit(0);
                } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode !== 401) {
                    await delay(10000);
                    conn();
                }
            });
        } catch (err) {
            
            conn();
            await removeFile('./session');
            if (!res.headersSent) {
                await res.send({ code: "Service Unavailable" });
            }
        }
    }
    return await conn();
});
