const http = require('http');
const express = require('express');

var process = require('process')

process.on('SIGINT', () => {
  console.info("SIGINT Received, exiting...")
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.info("SIGTERM Received, exiting...")
  process.exit(0)
})

const parser = require('ua-parser-js');
const { uniqueNamesGenerator } = require('unique-names-generator');

const PREFIXES = [
    'Anggrek',
    'Aren',
    'Asoka',
    'Aster',
    'Bakau',
    'Bakung',
    'Bambu',
    'Bugenvil',
    'Ceri',
    'Cempaka',
    'Cendana',
    'Cengkeh',
    'Dahlia',
    'Damar',
    'Duku',
    'Durian',
    'Gaharu',
    'Jahe',
    'Jambu',
    'Jarak',
    'Jati',
    'Jeruk',
    'Kamala',
    'Krisan',
    'Kelapa',
    'Kemiri',
    'Kenanga',
    'Kopi',
    'Kunyit',
    'Labu',
    'Lada',
    'Lavender',
    'Leci',
    'Lili',
    'Lumut',
    'Mangga',
    'Mawar',
    'Melati',
    'Meranti',
    'Nangka',
    'Nanas',
    'Naga',
    'Pakis',
    'Pala',
    'Pandan',
    'Pepaya',
    'Pinus',
    'Pisang',
    'Rosela',
    'Rotan',
    'Sagu',
    'Salak',
    'Serai',
    'Seruni',
    'Soka',
    'Sukun',
    'Talas',
    'Teratai',
];

const VIRTUES = [
    'Abadi',
    'Adil',
    'Agung',
    'Aman',
    'Amanah',
    'Andal',
    'Anggun',
    'Arif',
    'Asri',
    'Bahagia',
    'Bakti',
    'Benar',
    'Berani',
    'Berkat',
    'Bestari',
    'Bijak',
    'Budiman',
    'Cahaya',
    'Cekatan',
    'Cemerlang',
    'Cerdas',
    'Damai',
    'Dermawan',
    'Elok',
    'Gagah',
    'Gemilang',
    'Gembira',
    'Harmoni',
    'Hebat',
    'Hening',
    'Hormat',
    'Ikhlas',
    'Indah',
    'Jaya',
    'Jernih',
    'Jujur',
    'Juara',
    'Kuat',
    'Kukuh',
    'Lancar',
    'Luhur',
    'Makmur',
    'Megah',
    'Menawan',
    'Mulia',
    'Murni',
    'Perkasa',
    'Pesona',
    'Rahmat',
    'Rajin',
    'Ramah',
    'Riang',
    'Rupawan',
    'Sabar',
    'Sakti',
    'Saleh',
    'Santun',
    'Sehat',
    'Sempurna',
    'Sentosa',
    'Setia',
    'Syahdu',
    'Tangguh',
    'Teduh',
];

class SnapdropServer {

    constructor(server) {
        const WebSocket = require('ws');

        this._wss = new WebSocket.Server({
            server: server,

            clientTracking: true,
            verifyClient: (info, done) => {
                const origin = info.req.headers.origin;
                const allowedOrigins = ['https://muchad.com']; 

                if (allowedOrigins.includes(origin)) {
                    done(true);
                } else {
                    console.warn(`Blocked connection from origin: ${origin}`);
                    done(false, 403, 'Forbidden');
                }
            }
        });

        this._wss.on('connection', (socket, request) => {
            this._onConnection(new Peer(socket, request));
        });

        this._wss.on('headers', (headers, response) => {
            if (!response.headers?.cookie?.includes('peerid=')) {
                response.peerId = Peer.uuid();
                headers.push(`Set-Cookie: peerid=${response.peerId}; SameSite=None; Secure`);
            }
            headers.push('Access-Control-Allow-Origin: https://muchad.com');
            headers.push('Access-Control-Allow-Credentials: true');
        });

        this._rooms = {};

        this._healthCheckInterval = setInterval(() => {
            this._wss.clients.forEach(ws => {

                if (ws.isAlive === false) {
                    console.log('Terminating dead connection...');
                    return ws.terminate();
                }

                ws.isAlive = false;
                ws.ping(() => {});
            });
        }, 15000); 
    }

    _initPeer(peer) {

    }

    _onConnection(peer) {

        peer.socket.isAlive = true;

        peer.socket.on('pong', () => {
            peer.socket.isAlive = true;
        });

        peer.socket.on('close', () => {
            console.log(`Socket closed for peer ${peer.id}, leaving room.`);
            this._leaveRoom(peer);
        });

        this._joinRoom(peer);
        peer.socket.on('message', message => this._onMessage(peer, message));
        peer.socket.on('error', console.error);

        this._send(peer, {
            type: 'display-name',
            message: {
                displayName: peer.name.displayName,
                deviceName: peer.name.deviceName,
                room: peer.room
            }
        });
    }

    _onHeaders(headers, response) {

        if (response.headers.cookie && response.headers.cookie.indexOf('peerid=') > -1) return;
        response.peerId = Peer.uuid();
        headers.push('Set-Cookie: peerid=' + response.peerId + "; SameSite=Strict; Secure");
    }

    _onMessage(sender, message) {
        try {
            message = JSON.parse(message);
        } catch (e) {
            return;
        }

        switch (message.type) {
            case 'disconnect':
                this._leaveRoom(sender);
                break;

        }

        if (message.to && this._rooms[sender.ip]) {
            const recipientId = message.to; 
            const recipient = this._rooms[sender.ip][recipientId];
            delete message.to;
            message.sender = sender.id;
            this._send(recipient, message);
            return;
        }

        if(message.displayName){
            sender.modifyDisplayName(message.displayName)
            for (const otherPeerId in this._rooms[sender.ip]) {
                if (otherPeerId === sender.id) continue;
                const otherPeer = this._rooms[sender.ip][otherPeerId];
                this._send(otherPeer, {
                    type: 'peer-modify-name',
                    peer: sender.getInfo()
                });
            }
        }
    }

    _joinRoom(peer) {
        if (!this._rooms[peer.ip]) {
            this._rooms[peer.ip] = {};
        }

        for (const otherPeerId in this._rooms[peer.ip]) {
            if (otherPeerId === peer.id) continue;
            const otherPeer = this._rooms[peer.ip][otherPeerId];
            this._send(otherPeer, {
                type: 'peer-joined',
                peer: peer.getInfo()
            });
        }

        const otherPeers = [];
        for (const otherPeerId in this._rooms[peer.ip]) {
            if (otherPeerId === peer.id) continue;
            otherPeers.push(this._rooms[peer.ip][otherPeerId].getInfo());
        }
        this._send(peer, {
            type: 'peers',
            peers: otherPeers,
            currentPeerInfo: peer.name
        });

        this._rooms[peer.ip][peer.id] = peer;
    }

    _leaveRoom(peer) {
        if (!peer || !this._rooms[peer.ip] || !this._rooms[peer.ip][peer.id]) return;

        console.log(`Peer ${peer.id} left room ${peer.ip}`);
        delete this._rooms[peer.ip][peer.id];

        if (Object.keys(this._rooms[peer.ip]).length === 0) {
            delete this._rooms[peer.ip];
        } else {
            for (const otherPeerId in this._rooms[peer.ip]) {
                const otherPeer = this._rooms[peer.ip][otherPeerId];
                this._send(otherPeer, { type: 'peer-left', peerId: peer.id });
            }
        }
    }

    _send(peer, message) {
        if (!peer || !peer.socket || peer.socket.readyState !== WebSocket.OPEN) return;
        message = JSON.stringify(message);
        peer.socket.send(message, error => {
            if (error) console.error(`Error sending message to ${peer.id}:`, error);
        });
    }

}

class Peer {
    constructor(socket, request) {
        this.socket = socket;
        this._setPeerValues(request);
        this._setIP(request);
        this._setPeerId(request)
        this.rtcSupported = request.url.indexOf('webrtc') > -1;
        this._setName(request);

    }

    _setPeerValues(request) {
        let params = (new URL(request.url, "http://server")).searchParams;
        let room = params.has("room") ? params.get("room").replace(/\D/g, '') : "";
        if (room.length == 6) {
            this.room = room;
        } else {
            this.room = '';
        }
    }

    _setIP(request) {
        if (this.room){
            this.ip = this.room;
        } else if (request.headers['x-forwarded-for']) {
            this.ip = request.headers['x-forwarded-for'].split(/\s*,\s*/)[0];
        } else {
            this.ip = request.connection.remoteAddress;
        }
        if (this.ip == '::1' || this.ip == '::ffff:127.0.0.1') {
            this.ip = '127.0.0.1';
        }
    }

    _setPeerId(request) {
        if (request.peerId) {
            this.id = request.peerId;
        } else {
            const cookieHeader = request.headers.cookie || '';
            const match = cookieHeader.match(/peerid=([^;]+)/);
            if (match) {
                this.id = match[1];
            } else {
                this.id = Peer.uuid(); 
            }
        }
    }

    toString() {
        return `<Peer id=${this.id} ip=${this.ip} rtcSupported=${this.rtcSupported}>`
    }

    _setName(req) {
        let ua = parser(req.headers['user-agent']);
        let deviceName = '';
        if (ua.os && ua.os.name) {
            deviceName = ua.os.name.replace('Mac OS', 'Mac') + ' ';
        }
        if (ua.device.model) {
            deviceName += ua.device.model;
        } else {
            deviceName += ua.browser.name;
        }
        if(!deviceName)
            deviceName = 'Unknown Device';
        let hasCookieDisplayName = req.url.indexOf('lastDisplayName') > -1
        const displayName = hasCookieDisplayName? decodeURIComponent((new RegExp('[?|&]lastDisplayName='+'([^&;]+?)(&|#|;|$)').exec(req.url)||[,""])[1].replace(/\+/g,'%20'))||null :
        uniqueNamesGenerator({
            length: 2,
            separator: ' ',
            dictionaries: [PREFIXES, VIRTUES],
            style: 'capital',
            seed: this.id.hashCode()
        })
        this.name = {
            model: ua.device.model,
            os: ua.os.name,
            browser: ua.browser.name,
            type: ua.device.type,
            deviceName,
            displayName
        };
    }

    getInfo() {
        return {
            id: this.id,
            name: this.name,
            room: this.room,
            rtcSupported: this.rtcSupported
        }
    }

    modifyDisplayName(dispalyName) {
        this.name.displayName = dispalyName
    }

    static uuid() {
        let uuid = '', ii;
        for (ii = 0; ii < 32; ii += 1) {
            switch (ii) {
                case 8: case 20: uuid += '-'; uuid += (Math.random() * 16 | 0).toString(16); break;
                case 12: uuid += '-'; uuid += '4'; break;
                case 16: uuid += '-'; uuid += (Math.random() * 4 | 8).toString(16); break;
                default: uuid += (Math.random() * 16 | 0).toString(16);
            }
        }
        return uuid;
    };
}

Object.defineProperty(String.prototype, 'hashCode', {
  value: function() {
    var hash = 0, i, chr;
    for (i = 0; i < this.length; i++) {
      chr   = this.charCodeAt(i);
      hash  = ((hash << 5) - hash) + chr;
      hash |= 0; 
    }
    return hash;
  }
});

const app = express();
app.get('/ping', (req, res) => {
  console.log('Ping received!');
  res.status(200).send('OK');
});
const port = process.env.PORT || 4000;
const server = http.createServer(app);
const snapdropServer = new SnapdropServer(server);
server.listen(port, () => {
  console.log(`Server listening on port ${port} for both HTTP and WebSocket`);
});
