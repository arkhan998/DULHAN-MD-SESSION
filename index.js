const express = require('express');
const path = require('path');
const body = require("body-parser");
const axios = require('axios');
const { create } = require('./megajs/makeSession');
const { get } = require("./megajs/makeSession"); 

function ToMyId(len = 4) {
    let res = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < len; i++) {
        res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
}

const fs = require('fs');
const pino = require("pino");
const {
    default: WASocket,
    useMultiFileAuthState,
    delay,
    Browsers,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");

const app = express();
const root = process.cwd();
const port = process.env.PORT || 8000;

app.use(body.json());
app.use(body.urlencoded({ extended: true }));
app.use(express.static(path.join(root, 'statics')));

function rmFile(path) {
    if (!fs.existsSync(path)) return false;
    fs.rmSync(path, { recursive: true, force: true });
}

app.get('/', (req, res) => {
    res.sendFile(path.join(root, '/statics/index.html'));
});

app.get('/pair.html', (req, res) => {
    res.sendFile(path.join(root, '/statics/pair.html'));
});

app.get('/session', async (req, res) => {
    const q = req.query.q;
    if (!q) { return res.status(400).json({
            ok: false,
            msg: 'err missing q'
        });
    }

    const query = q.split(';')[1];
    try { const data = await get(query);
        res.json({
            ok: true,
            data: data.content
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ok: false, msg: 'server errr', err: err.message
        });
    }
});

app.get('/pair', async (req, res) => {
    const id = ToMyId();
    let num = req.query.number;
    async function pair() {
        const { state, saveCreds } = await useMultiFileAuthState('./session/' + id);
        try {
            let wa = WASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({level: "fatal"}).child({level: "fatal"})),
                },
                logger: pino({level: "fatal"}).child({level: "fatal"}),
                browser: Browsers.macOS("Safari"),
            });

            if (!wa.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                const code = await wa.requestPairingCode(num);
                if (!res.headersSent) {
                    await res.json({ code });
                }
            }

            wa.ev.on('creds.update', saveCreds);
            wa.ev.on("connection.update", async (state) => {
                const { connection, lastDisconnect } = state;
                if (connection == "open") {
                    await delay(5000);
                    await delay(5000);
                    const json = await fs.promises.readFile(`${root}/session/${id}/creds.json`, 'utf-8');     
                    const { id: sessionId } = await create(json);
                    await wa.sendMessage(wa.user.id, { text: 'xastral~' + sessionId });
                    await delay(100);
                    await wa.ws.close();
                    return await rmFile('./session/' + id);
                } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != 401) {
                    await delay(10000);
                    pair();
                }
            });
        } catch (err) {
            console.error(err);
            await rmFile('./session/' + id);
            if (!res.headersSent) {
                res.status(500).json({ error: "Service unavailable" });
            }
        }
    }

    return await pair();
});

app.listen(port, () => {
    console.log(`Server running on:${port}`);
});
