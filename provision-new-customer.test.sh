#!/usr/bin/env bash
# provision-new-customer.sh 测试（dry-run 模式，不触真实环境）
set -u
cd "$(dirname "$0")"

PASS=0; FAIL=0
check() { # check <desc> <cmd...>
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then PASS=$((PASS+1)); echo "PASS: $desc";
  else FAIL=$((FAIL+1)); echo "FAIL: $desc"; fi
}

echo "== bash 语法 =="
check "bash -n 语法检查" bash -n provision-new-customer.sh

echo "== 使用说明与必填参数 =="
OUT=$(bash provision-new-customer.sh 2>&1 || true)
echo "$OUT" | grep -q "customer-id" && echo "PASS: 无参数时打印用法" && PASS=$((PASS+1)) || { echo "FAIL: 无参数时打印用法"; FAIL=$((FAIL+1)); }

echo "== 必填参数校验 =="
OUT=$(bash provision-new-customer.sh --customer-id acme 2>&1 || true)
echo "$OUT" | grep -qi "domain" && echo "PASS: 缺 --domain 报错" && PASS=$((PASS+1)) || { echo "FAIL: 缺 --domain 报错"; FAIL=$((FAIL+1)); }

echo "== dry-run 不执行副作用 =="
OUT=$(bash provision-new-customer.sh --customer-id acme --domain acme.example.com --admin-email a@b.com --server-host 1.2.3.4 --dry-run 2>&1 || true)
echo "$OUT" | grep -q "DRY-RUN" && echo "PASS: dry-run 输出标记" && PASS=$((PASS+1)) || { echo "FAIL: dry-run 输出标记"; FAIL=$((FAIL+1)); }
echo "$OUT" | grep -q "pg_dump" && echo "PASS: dry-run 仍打印将执行的命令" && PASS=$((PASS+1)) || { echo "FAIL: dry-run 打印命令"; FAIL=$((FAIL+1)); }

echo ""
echo "结果: $PASS 通过, $FAIL 失败"
[ "$FAIL" -eq 0 ]
