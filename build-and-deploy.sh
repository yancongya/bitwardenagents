#!/bin/bash
# bwvault 一键构建、清理、部署脚本
# 用法: ./build-and-deploy.sh [--clean] [--force]

set -e

IMAGE_NAME="bwvault"
CONTAINER_NAME="bwvault"
VOLUME_NAME="bwvault-data"
HTTPS_PORT=3443
HTTP_PORT=3000

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# 参数解析
CLEAN=false
FORCE=false
for arg in "$@"; do
  case $arg in
    --clean) CLEAN=true ;;
    --force) FORCE=true ;;
  esac
done

# 检查是否在项目目录
if [ ! -f "Dockerfile" ] || [ ! -f "package.json" ]; then
  error "请在 bitwarden-vault-manager 项目目录下运行此脚本"
fi

log "开始构建 bwvault..."

# 停止并删除旧容器（如果存在）
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  warn "停止并删除旧容器..."
  docker stop "$CONTAINER_NAME" 2>/dev/null || true
  docker rm "$CONTAINER_NAME" 2>/dev/null || true
fi

# 清理旧镜像（可选）
if [ "$CLEAN" = true ]; then
  warn "清理旧镜像..."
  docker images "$IMAGE_NAME" --format '{{.Tag}}' | grep -v 'latest' | xargs -I {} docker rmi "$IMAGE_NAME:{}" 2>/dev/null || true
fi

# 构建新镜像
log "构建 Docker 镜像..."
docker build -t "$IMAGE_NAME:latest" . --quiet

# 确保卷存在
if ! docker volume inspect "$VOLUME_NAME" >/dev/null 2>&1; then
  log "创建持久化卷 $VOLUME_NAME..."
  docker volume create "$VOLUME_NAME"
fi

# 启动容器
log "启动容器..."
docker run -d \
  --name "$CONTAINER_NAME" \
  -p "$HTTP_PORT:3000" \
  -p "$HTTPS_PORT:3443" \
  -v "$VOLUME_NAME:/data" \
  --restart unless-stopped \
  "$IMAGE_NAME:latest"

# 等待健康检查
log "等待容器就绪..."
for i in {1..30}; do
  if docker inspect --format='{{.State.Health.Status}}' "$CONTAINER_NAME" 2>/dev/null | grep -q "healthy"; then
    log "容器已就绪！"
    break
  fi
  if [ $i -eq 30 ]; then
    warn "容器启动超时，请检查日志: docker logs $CONTAINER_NAME"
  fi
  sleep 1
done

# 显示状态
echo ""
log "部署完成！"
echo "  HTTP:  http://localhost:$HTTP_PORT"
echo "  HTTPS: https://192.168.31.110:$HTTPS_PORT"
echo ""
log "Session 已持久化到卷: $VOLUME_NAME"
log "重启容器无需重新登录"
echo ""
log "常用命令:"
echo "  查看日志: docker logs -f $CONTAINER_NAME"
echo "  停止服务: docker stop $CONTAINER_NAME"
echo "  重启服务: docker restart $CONTAINER_NAME"
echo "  清理所有: docker stop $CONTAINER_NAME && docker rm $CONTAINER_NAME && docker volume rm $VOLUME_NAME"
