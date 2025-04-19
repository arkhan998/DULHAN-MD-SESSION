const axios = require('axios');
const { create } = require('./megajs/makeSession');
const { toid } = require('./megajs/id');
const QRCode = require('qrcode');
const express = require('express');
const path = require('path');
const fs = require('fs');
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    jidNormalizedUser,
    Browsers,
    delay,
    makeInMemoryStore,
} = require("@whiskeysockets/baileys");

const { readFile } = require("node:fs/promises")

let router = express.Router()

function rm(gp) {
    if (!fs.existsSync(gp)) return false;
    fs.rmSync(gp, {
        recursive: true,
        force: true
    })
};

router.get('/', async (req, res) => {
    const id = toid();
    async function conn() {
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id)
        try {
            let session = makeWASocket({
                auth: state,
                printQRInTerminal: false,
                logger: pino({
                    level: "silent"
                }),
                browser: Browsers.macOS("Desktop"),
            });

            session.ev.on('creds.update', saveCreds)
            session.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect, qr } = s;
                if (qr) await res.end(await QRCode.toBuffer(qr));
                if (connection == "open") {
                    await delay(5000);
                    await delay(5000);
                    const cx = await fs.promises.readFile(`${__dirname}/session/${id}/creds.json`, 'utf-8');
                    const { id: data } = await create(cx);
                    await session.sendMessage(session.user.id, { text: 'xastral-' + data });
                    await delay(100);
                    await session.ws.close();
                    return await rm("session/" + id);
                } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != 401) {
                    await delay(10000);
                    conn();
                }
            });
        } catch (err) {
            if (!res.headersSent) {
                await res.json({
                    code: "Service Unavailable"
                });
            }
            console.log(err);
            await rm("session/" + id);
        }
    }
    return await conn()
});
