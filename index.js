const axios = require('axios');
const { create } = require('./megajs/makeSession');
const { toid } = require('./megajs/id');
const express = require('express');
const fs = require('fs');
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    Browsers,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");

const app = express();
const router = express.Router();

function rm(fp) {
    if (!fs.existsSync(fp)) return false;
    fs.rmSync(fp, { recursive: true, force: true });
}

router.get('/pair', async (req, res) => {
    const id = toid();
    let num = req.query.number;

    async function conn() {
        const { state, saveCreds } = await useMultiFileAuthState('./session/' + id);
        try {
            let s = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({level: "fatal"}).child({level: "fatal"})),
                },
                printQRInTerminal: false,
                logger: pino({level: "fatal"}).child({level: "fatal"}),
                browser: Browsers.macOS("Safari"),
            });

            if (!s.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                const code = await s.requestPairingCode(num);
                if (!res.headersSent) {
                    return res.send({ code });
                }
            }

            s.ev.on('creds.update', saveCreds);
            s.ev.on("connection.update", async (ss) => {
                const { connection, lastDisconnect } = ss;
                if (connection == "open") {
                    await delay(5000);
                    const x = await fs.promises.readFile(`${__dirname}/session/${id}/creds.json`, 'utf-8');     
                    const { id: data } = await create(x);
                    await s.sendMessage(s.user.id, { text: 'xastral-' + data });

                    await delay(100);
                    await s.ws.close();
                    return await rm('./session/' + id);
                } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != 401) {
                    await delay(10000);
                    conn();
                }
            });
        } catch (err) {
            console.log("service restarted", err);
            await rm('./session/' + id);
            if (!res.headersSent) {
                return res.send({ code: "Service Unavailable" });
            }
        }
    }

    return await conn();
});

app.use(express.json());
app.use(express.static('statics'));
app.use('/', router);

app.get('/', (req, res) => {
    res.sendFile('index.html', { root: './statics' });
});

app.get('/scan', (req, res) => {
    res.sendFile('scan.html', { root: './statics' });
});

app.listen(5000, '0.0.0.0', () => {
    console.log('Server running on port 5000');
});