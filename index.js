const express = require('express');
const fs = require('fs');
const app = express();
const router = express.Router();
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

async function createSocket(num, res) {
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
                return res.send({ code });
            }
        }

        Socket.ev.on('creds.update', saveCreds);
        Socket.ev.on("connection.update", async (s) => {
            const { connection, lastDisconnect } = s;
            if (connection === "open") {
                try {
                    await delay(10000);
                    const auth_path = './session/';
                    const ctx = jidNormalizedUser(Socket.user.id);
                    const mega_url = await upload(fs.createReadStream(auth_path + 'creds.json'), `${ctx}.json`);
                    const str = mega_url.replace('https://mega.nz/file/', '');
                    const sid = `xatsral~${str}`;
                    await Socket.sendMessage(ctx, {
                        text: sid
                    });
                } catch (e) {
                    console.error(e);
                }

                await delay(100);
                removeFile('./session');
                process.exit(0);
            } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode !== 401) {
                await delay(10000);
                conn(); // Assuming 'conn' is defined elsewhere
            }
        });
    } catch (err) {
        console.error(err);
        await removeFile('./session');
        if (!res.headersSent) {
            return res.send({ code: "Service Unavailable" });
        }
    }
}

router.get('/', async (req, res) => {
    try {
        let num = req.query.number;
        if (!num) {
            return res.status(400).send({ error: 'Phone number is required' });
        }
        await createSocket(num, res);
    } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});


// Setup express app
app.use(express.json());
app.use('/', router);

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
