#!/bin/bash

set -e

echo "======================================"
echo "    前后端 API 通信测试脚本"
echo "======================================"
echo ""

TEST_PASSED=0
TEST_FAILED=0

test_endpoint() {
  local name=$1
  local url=$2
  echo -n "测试 $name..."
  
  response=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  
  if [ "$response" -eq 200 ]; then
    echo -e "\033[32m 成功 (HTTP $response)\033[0m"
    TEST_PASSED=$((TEST_PASSED + 1))
    return 0
  else
    echo -e "\033[31m 失败 (HTTP $response)\033[0m"
    TEST_FAILED=$((TEST_FAILED + 1))
    return 1
  fi
}

test_frontend_proxy() {
  local name=$1
  local url=$2
  echo -n "测试前端代理 $name..."
  
  response=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  
  if [ "$response" -eq 200 ]; then
    echo -e "\033[32m 成功 (HTTP $response)\033[0m"
    TEST_PASSED=$((TEST_PASSED + 1))
    return 0
  else
    echo -e "\033[31m 失败 (HTTP $response)\033[0m"
    TEST_FAILED=$((TEST_FAILED + 1))
    return 1
  fi
}

echo "--- 后端 API 测试 ---"
test_endpoint "站点设置" "http://localhost:1337/api/site-settings"
test_endpoint "导航" "http://localhost:1337/api/navigation"
test_endpoint "页脚" "http://localhost:1337/api/footer"
test_endpoint "首页" "http://localhost:1337/api/pages/homepage"
test_endpoint "产品分类" "http://localhost:1337/api/product-categories"
test_endpoint "产品" "http://localhost:1337/api/products"
test_endpoint "FAQ" "http://localhost:1337/api/faq-items"
test_endpoint "知识库" "http://localhost:1337/api/knowledge-bases"

echo ""
echo "--- 前端代理测试 ---"
test_frontend_proxy "站点设置" "http://localhost:5173/api/site-settings"
test_frontend_proxy "导航" "http://localhost:5173/api/navigation"
test_frontend_proxy "首页" "http://localhost:5173/api/pages/homepage"

echo ""
echo "--- 前端页面测试 ---"
test_endpoint "前端首页" "http://localhost:5173/"

echo ""
echo "======================================"
echo "    测试结果汇总"
echo "======================================"
echo "通过: $TEST_PASSED"
echo "失败: $TEST_FAILED"

if [ $TEST_FAILED -eq 0 ]; then
  echo -e "\033[32m✓ 所有测试通过！\033[0m"
  exit 0
else
  echo -e "\033[31m✗ 有 $TEST_FAILED 个测试失败\033[0m"
  exit 1
fi