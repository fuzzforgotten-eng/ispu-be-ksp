import express from 'express'
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';
import { dirname } from 'path';
import authRoutes from '../routes/auth.js';
import {  processSensorTableData } from '../controllers/data_report.js';
import { processSensorTableDataWeather } from '../controllers/data_report.js';
import { WebSocketServer } from 'ws'


const app = express()
app.use(express.json())

const allowedOrigins = [
  'http://localhost:5173',
  'http://192.168.1.56:5173',
  'https://ksp.ispu.mdtapps.id',
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const router = express.Router();

const server = app.listen(3200, () => {
  console.log("Server running on http://0.0.0.0:3200");
});

const wss = new WebSocketServer({ server })

const clients = new Set()

wss.on('connection', (ws) => {
  console.log('Client WebSocket connected')
  clients.add(ws)

  ws.on('message', (msg) => {
    console.log('Message from client:', msg.toString())
    ws.send(JSON.stringify({ reply: 'pong' }))
  })

  ws.on('close', () => {
    clients.delete(ws)
    console.log('Client disconnected')
  })
})


app.post('/data/ispu', async (req, res) => {
  try {
    const result = await processSensorTableData(req.body);

    res.json(result);

    const payload = JSON.stringify({
      type: 'DATA_2MENIT_UPDATE',
      data: result,
    })

    for (const client of clients) {
      if (client.readyState === 1) {
        client.send(payload)
      }
    }

  } catch (err) {
    console.error('[ERROR] /data/ISPU', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})


app.post('/data/weather', async (req, res) => {
  try {
    const result = await processSensorTableDataWeather(req.body);

    res.json(result);

    const payload = JSON.stringify({
      type: 'WEATHER_UPDATE',
      data: result,
    })

    for (const client of clients) {
      if (client.readyState === 1) {
        client.send(payload)
      }
    }

  } catch (err) {
    console.error('[ERROR] /data/weather', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})



router.get('/download/:filename', (req, res) => {
  const filePath = path.join(__dirname, '../../public/export', req.params.filename);
  res.download(filePath, req.params.filename, (err) => {
    if (err) {
      console.error(err);
      res.status(404).json({ error: 'File not found' });
    }
  });
});

app.use('/auth', authRoutes);
app.use(router)


