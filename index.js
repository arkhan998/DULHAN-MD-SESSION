const axios = require('axios');
const { create } = require('./session');
const { makeid } = require('./megajs/id');
const express = require('express');
const fs = require('fs');
let r = express.Router();
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    Browsers,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");

function rm(fp) {
    if (!fs.existsSync(fp)) return false;
    fs.rmSync(fp, { recursive: true, force: true });
};

r.get('/', async (req, res) => {
    const id = makeid();
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
                    await res.send({ code });
                }
            }

            s.ev.on('creds.update', saveCreds);
            s.ev.on("connection.update", async (ss) => {
                const { connection, lastDisconnect } = ss;
                if (connection == "open") {
                    await delay(5000);
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
            console.log("service restated");
            await rm('./session/' + id);
            if (!res.headersSent) {
                await res.send({ code: "Service Unavailable" });
            }
        }
    }

    return await conn();
});

app.use(ex.json());
app.use(ex.static('statics'));

app.get('/', (q, s) => {
    s.sendFile('pair.html', { root: './statics' });
});

r.get('/pair', async (q, s) => {
    try {
        let n = q.query.number;
        if (!n) {
            return s.status(400).send({ error: 'Phone number is required' });
        }
        await conn(n, s);
    } catch (e) {
        console.error(e);
        s.status(500).send({ error: 'Internal Server Error' });
    }
});

app.use('/api', r);
app.listen(5000, () => {
    console.log('Run on 5000');
});
