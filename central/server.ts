import { createServer } from 'node:http';
import { parse } from 'node:url';
import next from 'next';
import { WebSocketServer } from 'ws';
import { verifyAgentToken } from './lib/agent-auth';
import { addConnection } from './lib/connections';
import { handleAgentMessage } from './lib/agent-router';
import { startHeartbeatMonitor } from './lib/heartbeat-monitor';
import { startJobTimeoutMonitor } from './lib/job-manager';

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT ?? '3000', 10);
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res, parse(req.url!, true)));
  const wss = new WebSocketServer({ noServer: true });

  const pingInterval = setInterval(() => {
    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) client.ping();
    }
  }, 30000);
  const jobMonitor = startJobTimeoutMonitor({}, 60000);
  wss.on('close', () => {
    clearInterval(pingInterval);
    clearInterval(jobMonitor);
  });

  startHeartbeatMonitor(60, 10000);

  // Our WebSocket upgrade handler — bypasses Next.js's crashing upgrade handler.
  // Next.js 14 lazily adds its upgrade handler on the first HTTP request,
  // and it crashes with `TypeError: Cannot read properties of undefined (reading 'bind')`,
  // destroying the socket. Using server.removeAllListeners('upgrade') is racy because
  // Next.js adds its handler after we remove them.
  // Fix: override server.emit to intercept 'upgrade' events and route them only to our handler.
  const upgradeHandler = (req: any, socket: any, head: any) => {
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
        // Send welcome immediately upon connection to confirm authentication.
        // agent:register is a separate client-initiated step that only updates DB state.
        ws.send(JSON.stringify({ type: 'agent:welcome', serverId: serverRow.id }));
      });
    }).catch((err) => {
      console.error('[ws] upgrade failed:', err);
      socket.destroy();
    });
  };

  const originalEmit = server.emit.bind(server);
  server.emit = function (event: string, ...args: any[]) {
    if (event === 'upgrade') {
      const { pathname } = parse(args[0].url!, true);
      if (pathname === '/api/agent/ws') {
        // Route agent WS upgrades only to our handler, bypassing Next.js's crashing handler.
        upgradeHandler(args[0], args[1], args[2]);
        return true;
      }
      // Non-agent upgrades (e.g. Next.js HMR in dev) fall through to the original listeners.
    }
    return originalEmit(event, ...args);
  } as typeof server.emit;

  server.listen(port);

  console.log(`> Ready on http://localhost:${port} (dev=${dev})`);
});
