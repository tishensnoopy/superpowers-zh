import { NextRequest } from 'next/server';
import { errorResponse, requireAdmin } from '@/lib/api-helpers';
import { query } from '@/lib/db';
import { generateEnrollmentCode } from '@/lib/agent-auth';
import { writeAuditLog } from '@/lib/audit';

/**
 * 生成新客户裸机开通引导脚本（一次性 enrollment code，24h 有效）。
 * 挂 customer 维度：裸机尚无 customer_servers 记录——enroll 时路由自动 INSERT 登记
 * （已核实 enroll/route.ts:44-53，同 customer 下 hostname 重复返回 409）。
 * 运营方把脚本拷到裸机执行：装 docker → enroll 拿 token → 下载发布包 → 起 agent。
 * 之后一切（写 env/部署/初始化）由 central provision 命令全自动完成。
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const cust = await query(`SELECT id, name FROM customers WHERE id=$1`, [params.id]);
  if (cust.rows.length === 0) return errorResponse('Customer not found', 404);

  const latest = await query(`SELECT id FROM bundles WHERE status='ready' ORDER BY created_at DESC LIMIT 1`);
  if (latest.rows.length === 0) return errorResponse('No ready bundle. Build a bundle first.', 409);
  const bundleId = (latest.rows[0] as { id: string }).id;

  const code = await generateEnrollmentCode(params.id);
  const centralApiUrl = process.env.CENTRAL_PUBLIC_URL ?? req.nextUrl.origin;

  const script = `#!/usr/bin/env bash
# 客户裸机开通引导脚本（central 生成，enrollment code 24h 一次性有效）
# 用法: sudo bash bootstrap-agent.sh
set -euo pipefail

CENTRAL_API="${centralApiUrl}"
ENROLL_CODE="${code}"
DEPLOY_DIR="/opt/customer-site"
AGENT_ENV_DIR="/etc/yousen-agent"

echo "[1/4] 检查 docker..."
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi
docker compose version >/dev/null 2>&1 || apt-get update -qq && apt-get install -y -qq docker-compose-v2
command -v rsync >/dev/null 2>&1 || apt-get install -y -qq rsync

echo "[2/4] 向 central 注册（enroll）..."
RESP=$(curl -sf -X POST "$CENTRAL_API/api/agent/enroll" \\
  -H 'Content-Type: application/json' \\
  -d "{\\"enrollmentCode\\":\\"$ENROLL_CODE\\",\\"hostname\\":\\"$(hostname)\\"}")
SERVER_ID=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["serverId"])')
TOKEN=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["agentToken"])')

echo "[3/4] 下载发布包..."
mkdir -p "$DEPLOY_DIR"
curl -sf -H "Authorization: Bearer $TOKEN" \\
  "$CENTRAL_API/api/agent/bundles/${bundleId}/download" -o /tmp/release.tar.gz
tar -xzf /tmp/release.tar.gz -C "$DEPLOY_DIR"
rm -f /tmp/release.tar.gz

echo "[4/4] 启动 agent..."
mkdir -p "$AGENT_ENV_DIR"
cat > "$AGENT_ENV_DIR/agent.env" <<ENVEOF
CENTRAL_API_URL=$CENTRAL_API
CENTRAL_WS_URL=\${CENTRAL_API/http/ws}/api/agent/ws
SERVER_ID=$SERVER_ID
AGENT_TOKEN=$TOKEN
ENVEOF
chmod 600 "$AGENT_ENV_DIR/agent.env"
cd "$DEPLOY_DIR"
DEPLOY_PATH="$DEPLOY_DIR" CENTRAL_WS_URL="\${CENTRAL_API/http/ws}/api/agent/ws" \\
  envsubst < scripts/agent-compose.yml | docker compose -f - up -d --build

echo "✅ agent 已上线。请回 central 对该服务器执行「一键开通」（provision）完成部署。"
`;

  await writeAuditLog({
    adminId: admin.sub,
    action: 'enrollment:issue',
    targetType: 'customer',
    targetId: params.id,
    detail: { via: 'bootstrap-script', bundleId },
  });

  return new Response(script, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'content-disposition': 'attachment; filename="bootstrap-agent.sh"',
    },
  });
}
