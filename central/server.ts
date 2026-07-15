import { createServer } from 'node:http';
import { parse } from 'node:url';
import next from 'next';
import { WebSocketServer } from 'ws';
import { verifyAgentToken } from '@/lib/agent-auth';
import { addConnection } from '@/lib/connections';
import { handleAgentMessage } from '@/lib/agent-router';
import { startHeartbeatMonitor } from '@/lib/heartbeat-monitor';

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT ?? '3000', 10);
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res, parse(req.url!, true)));
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { pathname, query } = parse(req.url!, true);
    if (pathname !== '/api/agent/ws') return;

    const token = query.token as string | undefined;
    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    verifyAgentToken(token).then((serverRow) => {
      if (!serverRow) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, async (ws) => {
        const remove = addConnection(serverRow.id, ws);
        ws.on('close', () => {
          remove();
        });
        ws.on('message', (raw) => {
          try {
            const msg = JSON.parse(raw.toString());
            handleAgentMessage(ws, serverRow.id, msg);
          } catch (err) {
            console.error('[ws] message handling failed:', err);
          }
        });
      });
    }).catch((err) => {
      console.error('[ws] upgrade failed:', err);
      socket.destroy();
    });
  });

  const pingInterval = setInterval(() => {
    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) client.ping();
    }
  }, 30000);
  wss.on('close', () => clearInterval(pingInterval));

  startHeartbeatMonitor(60, 10000);

  server.listen(port);
  console.log(`> Ready on http://localhost:${port} (dev=${dev})`);
});
