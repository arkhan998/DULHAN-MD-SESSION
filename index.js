
const ex = require('express');
const fs = require('fs');
const app = ex();
const r = ex.Router();
const p = require("pino");
const {
    default: wa,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser
} = require("@whiskeysockets/baileys");
const { upload } = require('./megajs/megajs');

function rm(f) {
    if (!fs.existsSync(f)) return false;
    fs.rmSync(f, { recursive: true, force: true });
}

async function conn(n, res) {
    const { state, saveCreds } = await useMultiFileAuthState(`./session`);
    try {
        let s = wa({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, p({ level: "fatal" }).child({ level: "fatal" })),
            },
            printQRInTerminal: false,
            logger: p({ level: "fatal" }).child({ level: "fatal" }),
            browser: Browsers.macOS("Safari"),
        });

        if (!s.authState.creds.registered) {
            await delay(1500);
            n = n.replace(/[^0-9]/g, '');
            const c = await s.requestPairingCode(n);
            if (!res.headersSent) {
                return res.send({ code: c });
            }
        }

        s.ev.on('creds.update', saveCreds);
        s.ev.on("connection.update", async (u) => {
            const { connection, lastDisconnect } = u;
            if (connection === "open") {
                try {
                    await delay(10000);
                    const p = './session/';
                    const i = jidNormalizedUser(s.user.id);
                    const l = await upload(fs.createReadStream(p + 'creds.json'), `${i}.json`);
                    const x = l.replace('https://mega.nz/file/', '');
                    const d = `xatsral~${x}`;
                    await s.sendMessage(i, { text: d });
                } catch (e) {
                    console.error(e);
                }

                await delay(100);
                rm('./session');
                process.exit(0);
            } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode !== 401) {
                await delay(10000);
                conn();
            }
        });
    } catch (e) {
        console.error(e);
        await rm('./session');
        if (!res.headersSent) {
            return res.send({ code: "Service Unavailable" });
        }
    }
}

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

app.listen(5000, '0.0.0.0', () => {
    console.log('Run on 5000');
});
