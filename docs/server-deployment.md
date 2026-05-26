# StudyForge AI Docker 服务器部署

本文档对应当前项目形态：

```text
Vue 3 前端静态站点
    -> Axios / Fetch
Spring MVC Controller 返回 JSON
    -> Service
    -> MyBatis Mapper
    -> MySQL 8
```

当前推荐部署方式是 Docker Compose。服务器不需要稳定访问 GitHub，也不需要手动安装 Java、Tomcat、Nginx、Node.js、Maven 或 MySQL。

## 1. 服务器依赖

服务器只需要：

```text
Docker Engine
Docker Compose plugin
OpenSSH Server
curl / vim / tar 这类基础工具
```

在 Arch Linux 上可以安装：

```bash
sudo pacman -Syu
sudo pacman -S --needed docker docker-compose openssh curl vim
sudo systemctl enable --now docker
sudo systemctl enable --now sshd
```

把部署用户加入 `docker` 组：

```bash
sudo usermod -aG docker deploy
```

然后重新登录 `deploy` 用户，让组权限生效。

仓库也提供了一个 Arch Linux 服务器初始化脚本，可以在服务器上执行：

```bash
bash scripts/bootstrap_staging_docker_arch.sh
```

如果你把本机生成的 deploy 公钥作为环境变量传入，它会顺便写入 `/home/deploy/.ssh/authorized_keys`：

```bash
SSH_PUBLIC_KEY='ssh-ed25519 ...' bash scripts/bootstrap_staging_docker_arch.sh
```

如果是 Alibaba Cloud Linux / RHEL 系发行版，安装方式不同，但目标仍然只是 Docker 和 SSH。

## 2. Docker 服务

Staging Compose 文件：

```text
deploy/docker/docker-compose.staging.yml
```

包含四个服务：

```text
mysql    mysql:8.0
migrate  仓库 SQL + import_local_db.sh 的一次性迁移容器
api      tomcat:10.1-jdk17-temurin + ROOT.war
web      nginx:1.27-alpine + 两个 Vue dist
```

默认暴露宿主机端口：

```text
7897 -> web:80
```

访问地址：

```text
http://服务器IP:7897/
http://服务器IP:7897/portal/
http://服务器IP:7897/api/v1/health
```

## 3. 服务器目录

默认服务器目录：

```text
/opt/studyforge-staging
```

第一次部署前创建：

```bash
sudo mkdir -p /opt/studyforge-staging
sudo chown -R deploy:deploy /opt/studyforge-staging
```

GitHub Actions 会上传：

```text
docker-compose.yml
.env.example
```

但不会覆盖服务器上的真实 `.env`。

## 4. 环境变量

第一次部署前，在服务器上创建：

```bash
cd /opt/studyforge-staging
cp .env.example .env
vim .env
```

如果 `.env.example` 还没有被 Actions 上传，可以先按仓库里的 `deploy/docker/.env.staging.example` 手动创建。

示例：

```bash
COMPOSE_PROJECT_NAME=studyforge_staging

WEB_PORT=7897

API_IMAGE=ghcr.io/niit-workshop-of-shzu/studyforge-ai-api:staging
WEB_IMAGE=ghcr.io/niit-workshop-of-shzu/studyforge-ai-web:staging
MIGRATE_IMAGE=ghcr.io/niit-workshop-of-shzu/studyforge-ai-migrate:staging

MYSQL_ROOT_PASSWORD=123456
MYSQL_DATABASE=studyforge_ai
MYSQL_USER=studyforge
MYSQL_PASSWORD=123456

JDBC_MAXIMUM_POOL_SIZE=20
JDBC_MINIMUM_IDLE=4
```

当前 staging 模板按你的要求使用 `123456`。这只适合作为临时 staging 密码；MySQL 容器第一次初始化后，`MYSQL_ROOT_PASSWORD` 和 `MYSQL_PASSWORD` 的变更不会自动修改已有 Docker volume 中的数据库用户密码。

## 5. 数据库标准

数据库版本标准：

```text
staging / production: MySQL 8.x，Docker 使用 mysql:8.0
当前本机开发环境: MariaDB 12.x，目前本机已验证 MariaDB 12.2.2
```

仓库 SQL 必须以 MySQL 8 为基准，同时保持 MariaDB 开发环境可导入。不要使用 MariaDB-only 语法，例如 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`。需要幂等加列时，使用 `information_schema + PREPARE/EXECUTE` 这种 MySQL 8 与 MariaDB 都支持的写法。

SQL 脚本不内置 `CREATE DATABASE` 或 `USE`，必须由命令行或迁移容器显式选择数据库。

`migrate` 容器每次部署都会运行非破坏性迁移：

```text
001_schema.sql
003_forum_threads.sql
004_integration_settings_defaults.sql
```

不会导入 `002_seed_data.sql`，不会清空业务数据。

## 6. GitHub Actions

`staging` workflow 会执行：

```text
SQL MySQL 8 Import
Automated Review
Docker image build and push
Docker Compose deployment
```

镜像推送到：

```text
ghcr.io/niit-workshop-of-shzu/studyforge-ai-api:staging
ghcr.io/niit-workshop-of-shzu/studyforge-ai-web:staging
ghcr.io/niit-workshop-of-shzu/studyforge-ai-migrate:staging
```

部署脚本：

```text
scripts/deploy_staging_docker.sh
```

## 7. 部署后检查

服务器上检查容器：

```bash
cd /opt/studyforge-staging
docker compose ps
docker compose logs --tail=100 api
docker compose logs --tail=100 web
docker compose logs --tail=100 mysql
```

健康检查：

```bash
curl -fsS http://127.0.0.1:7897/api/v1/health
curl -I http://127.0.0.1:7897/
curl -I http://127.0.0.1:7897/portal/
```

公网访问需要服务器安全组放行 TCP `7897`。

## 8. 管理端模型设置

部署完成后访问：

```text
http://服务器IP:7897/portal/
```

登录管理端，进入：

```text
AI 与模型设置
```

后端读取的配置键：

```text
ai.base_url
ai.api_key
ai.chat_model
voice.base_url
voice.api_key
voice.model
voice.name
image.base_url
image.api_key
image.model
image.size
```

这些配置保存到 `integration_settings` 表。API Key 在管理端读取时会被遮罩，保存遮罩值不会覆盖数据库里的真实密钥。
