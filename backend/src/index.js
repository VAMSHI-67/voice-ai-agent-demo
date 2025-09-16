import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import * as mm from 'music-metadata';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_BASE_URL = process.env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io/v1';
const ELEVENLABS_MODEL_ID = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

// Ensure audio output directory exists
const audioDir = path.join(__dirname, '..', 'public', 'audio');
fs.mkdirSync(audioDir, { recursive: true });

// Static serving for audio files
app.use('/audio', express.static(audioDir, {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
}));

// Root confirmation route and favicon handler to reduce 404 noise
app.get('/', (req, res) => {
  res.send('Voice AI Agent Backend is running!');
});

app.get('/favicon.ico', (req, res) => res.status(204).end());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend running', elevenlabsKeyConfigured: !!ELEVENLABS_API_KEY });
});

// GET /voices - Fetch available voices from ElevenLabs
app.get('/voices', async (req, res, next) => {
  try {
    if (!ELEVENLABS_API_KEY) {
      return res.status(500).json({ error: 'Missing ELEVENLABS_API_KEY' });
    }
    const r = await axios.get(`${ELEVENLABS_BASE_URL}/voices`, {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
      },
    });
    const voices = (r.data?.voices || []).map(v => ({ id: v.voice_id, name: v.name }));
    res.json(voices);
  } catch (err) {
    next(err);
  }
});

// POST /generate-voice { text, voiceId }
app.post('/generate-voice', async (req, res, next) => {
  try {
    const { text, voiceId, modelId } = req.body || {};
    if (!text || !voiceId) {
      return res.status(400).json({ error: 'Missing text or voiceId' });
    }
    if (!ELEVENLABS_API_KEY) {
      return res.status(500).json({ error: 'Missing ELEVENLABS_API_KEY' });
    }

    // ElevenLabs text-to-speech endpoint
    const url = `${ELEVENLABS_BASE_URL}/text-to-speech/${voiceId}`;
    let r;
    try {
      r = await axios.post(
        url,
        { text, model_id: modelId || ELEVENLABS_MODEL_ID },
        {
          responseType: 'arraybuffer',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg',
          },
        }
      );
    } catch (err) {
      // Surface ElevenLabs error details to the client for easier debugging
      const status = err.response?.status || 500;
      let details = err.response?.data || err.message || 'Unknown error';
      let message;
      // Attempt to decode JSON/text error if we requested arraybuffer (Node returns Buffer)
      try {
        const ct = (err.response?.headers?.['content-type'] || '').toLowerCase();
        if (ct.includes('application/json')) {
          if (Buffer.isBuffer(details)) {
            const text = details.toString('utf8');
            details = JSON.parse(text);
          } else if (details instanceof ArrayBuffer) {
            const text = Buffer.from(details).toString('utf8');
            details = JSON.parse(text);
          } else if (typeof details === 'string') {
            details = JSON.parse(details);
          }
        } else if (Buffer.isBuffer(details)) {
          details = details.toString('utf8');
        }
        // Common ElevenLabs format uses { detail: { status, message } }
        if (details && typeof details === 'object') {
          message = details.detail?.message || details.message;
        } else if (typeof details === 'string') {
          message = details;
        }
      } catch {}
      console.error('ElevenLabs TTS error:', status, message || details);
      return res.status(status).json({ error: 'ElevenLabs TTS error', status, message: message || undefined, details });
    }

    const id = uuidv4();
    const filename = `${id}.mp3`;
    const filepath = path.join(audioDir, filename);
    fs.writeFileSync(filepath, r.data);

    const audioUrl = `/audio/${filename}`;
    res.json({ audioUrl });
  } catch (err) {
    next(err);
  }
});

// Backward-compatible alias: POST /generate-call behaves like /generate-voice
app.post('/generate-call', async (req, res, next) => {
  try {
    const { text, voiceId, modelId } = req.body || {};
    if (!text || !voiceId) {
      return res.status(400).json({ error: 'Missing text or voiceId' });
    }
    if (!ELEVENLABS_API_KEY) {
      return res.status(500).json({ error: 'Missing ELEVENLABS_API_KEY' });
    }

    const url = `${ELEVENLABS_BASE_URL}/text-to-speech/${voiceId}`;
    let r;
    try {
      r = await axios.post(
        url,
        { text, model_id: modelId || ELEVENLABS_MODEL_ID },
        {
          responseType: 'arraybuffer',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg',
          },
        }
      );
    } catch (err) {
      const status = err.response?.status || 500;
      let details = err.response?.data || err.message || 'Unknown error';
      let message;
      try {
        const ct = (err.response?.headers?.['content-type'] || '').toLowerCase();
        if (ct.includes('application/json')) {
          if (Buffer.isBuffer(details)) {
            const text = details.toString('utf8');
            details = JSON.parse(text);
          } else if (details instanceof ArrayBuffer) {
            const text = Buffer.from(details).toString('utf8');
            details = JSON.parse(text);
          } else if (typeof details === 'string') {
            details = JSON.parse(details);
          }
        } else if (Buffer.isBuffer(details)) {
          details = details.toString('utf8');
        }
        if (details && typeof details === 'object') {
          message = details.detail?.message || details.message;
        } else if (typeof details === 'string') {
          message = details;
        }
      } catch {}
      console.error('ElevenLabs TTS error (/generate-call):', status, message || details);
      return res.status(status).json({ error: 'ElevenLabs TTS error', status, message: message || undefined, details });
    }

    const id = uuidv4();
    const filename = `${id}.mp3`;
    const filepath = path.join(audioDir, filename);
    fs.writeFileSync(filepath, r.data);

    const audioUrl = `/audio/${filename}`;
    res.json({ audioUrl });
  } catch (err) {
    next(err);
  }
});

// POST /simulate-call { audioUrl, toNumber }
app.post('/simulate-call', async (req, res, next) => {
  try {
    const { audioUrl, toNumber } = req.body || {};
    if (!audioUrl) {
      return res.status(400).json({ error: 'Missing audioUrl' });
    }
    // Derive file path from audioUrl
    const filename = path.basename(audioUrl);
    const filepath = path.join(audioDir, filename);
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Audio not found' });
    }

    // Parse audio duration
    const stream = fs.createReadStream(filepath);
    const metadata = await mm.parseStream(stream, { mimeType: 'audio/mpeg' }, { duration: true });
    stream.close();
    const duration = Math.ceil(metadata.format.duration || 0);

    // Mock status: playing
    res.json({ status: 'playing', duration, toNumber: toNumber || null });
  } catch (err) {
    next(err);
  }
});

// GET /simulate-call-sse?audioUrl=...&toNumber=...
// Streams call state events over time: initiated -> ringing -> connected -> playing -> ended
app.get('/simulate-call-sse', async (req, res, next) => {
  try {
    const { audioUrl, toNumber } = req.query || {};
    if (!audioUrl) {
      return res.status(400).json({ error: 'Missing audioUrl' });
    }

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const send = (event, data) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const filename = path.basename(audioUrl);
    const filepath = path.join(audioDir, filename);
    if (!fs.existsSync(filepath)) {
      send('error', { error: 'Audio not found' });
      return res.end();
    }

    // duration
    const stream = fs.createReadStream(filepath);
    const metadata = await mm.parseStream(stream, { mimeType: 'audio/mpeg' }, { duration: true });
    stream.close();
    const duration = Math.ceil(metadata.format.duration || 0);

    // sequence of events
    send('initiated', { toNumber: toNumber || null });
    const timers = [];
    timers.push(setTimeout(() => send('ringing', {}), 300));
    timers.push(setTimeout(() => send('connected', {}), 1200));
    timers.push(setTimeout(() => send('playing', { duration }), 1600));
    timers.push(setTimeout(() => { send('ended', {}); res.end(); }, 1600 + (duration + 1) * 1000));

    req.on('close', () => {
      timers.forEach(clearTimeout);
    });
  } catch (err) {
    next(err);
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`✅ Backend listening on port ${PORT}`);
});
