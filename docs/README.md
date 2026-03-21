# MOCHU-OA 施工管理系统技术文档

## 文档版本
- **版本**: v1.1.0
- **更新日期**: 2026-03-21
- **作者**: AI Assistant

## 项目概述

MOCHU-OA是一套面向施工企业的综合办公自动化系统，涵盖项目管理、合同管理、采购管理、库存管理、财务管理等核心业务模块。

### 技术栈

| 层级 | 技术选型 | 说明 |
|------|----------|------|
| **前端** | React 18 + Vite | 现代化前端框架 |
| **UI库** | Ant Design 5 | 企业级UI组件 |
| **状态管理** | React Hooks + Context | 轻量级状态管理 |
| **路由** | React Router 6 | 单页应用路由 |
| **HTTP客户端** | Axios | Promise based HTTP client |
| **后端** | Node.js + Express | RESTful API服务 |
| **数据库** | SQLite (better-sqlite3) | 轻量级嵌入式数据库 |
| **认证** | JWT (JSON Web Token) | 无状态认证，30天有效期+滑动过期 |
| **密码加密** | bcryptjs | 密码哈希 |

### 项目结构

```
MOCHU-OA-NEWTEST1/
├── backend/                 # 后端代码
│   ├── routes/             # API路由（29个路由文件，347个接口）
│   ├── services/           # 业务服务
│   ├── models/             # 数据模型
│   ├── middleware/         # 中间件
│   ├── database.db         # SQLite数据库
│   └── server.js           # 服务入口
├── frontend/               # 前端代码
│   ├── src/
│   │   ├── pages/         # 页面组件（57个页面）
│   │   ├── services/      # API服务
│   │   ├── components/    # 公共组件
│   │   └── utils/         # 工具函数
└── docs/                   # 技术文档（10份，316KB，10918行）
```

## 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm >= 8.0.0
- SQLite 3

### 安装步骤

```bash
# 1. 克隆项目
git clone https://github.com/SheridanLu/MOCHU-OA-NEWTEST1.git
cd MOCHU-OA-NEWTEST1

# 2. 安装后端依赖
cd backend
npm install

# 3. 安装前端依赖
cd ../frontend
npm install

# 4. 启动后端服务（开发模式）
cd ../backend
npm run dev

# 5. 构建并启动前端（生产模式）
cd ../frontend
npm run build
cd ../backend
pm2 start server.js --name oa-server
```

### 默认管理员账号

- **账号**: administrator
- **密码**: 999998

## 核心功能模块

| 模块 | 路由数 | 主要功能 |
|------|--------|---------|
| 认证授权 | 7 | 登录、短信验证、Token管理 |
| 用户管理 | 8 | 用户CRUD、状态管理 |
| 角色权限 | 18 | 角色CRUD、权限分配 |
| 部门管理 | 7 | 部门CRUD、层级管理 |
| 项目管理 | 17 | 项目CRUD、虚拟转实体、中止 |
| 合同管理 | 27 | 收入/支出合同、审批、超量检查 |
| 采购管理 | 41 | 采购清单、批量采购、零星采购 |
| 材料管理 | 16 | 基准价、价格预警、导入导出 |
| 库存管理 | 28 | 入库、出库、库存、预警 |
| 财务管理 | 37 | 材料付款、劳务付款、收款、对账单 |
| 审批流程 | 8 | 待审批、审批历史 |
| 施工管理 | 29 | 里程碑、进度、任务、偏差预警 |
| 竣工资料 | 24 | 竣工图纸、文档、劳务结算 |
| 变更管理 | 26 | 材料变更、现场签证、业主变更 |
| 成本报表 | 6 | 成本汇总、趋势、导出 |
| 人事管理 | 10 | 入职、离职、状态管理 |
| 邮件管理 | 8 | 企业邮箱生成、批量创建 |
| 审计日志 | 8 | 操作日志、统计分析 |
| **总计** | **347** | - |

## 部署说明

### 生产环境部署

```bash
# 使用PM2部署
cd backend
pm2 start server.js --name oa-server
pm2 save
pm2 startup
```

### Nginx反向代理配置

```nginx
server {
    listen 80;
    server_name mochu.group www.mochu.group;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 访问地址

- **生产环境**: http://mochu.group
- **开发环境**: http://localhost:3001

---

## 📚 技术文档目录

### 核心设计文档

| 文档 | 大小 | 内容 |
|------|------|------|
| [01-系统架构.md](./01-系统架构.md) | 22KB | 技术架构、认证流程、部署架构 |
| [07-数据库设计.md](./07-数据库设计.md) | 31KB | 25+张表设计、关系图、索引策略 |
| [08-审批流程设计.md](./08-审批流程设计.md) | 20KB | 21种审批类型、流程实现 |
| [09-权限系统设计.md](./09-权限系统设计.md) | 22KB | RBAC模型、50+权限代码 |

### API接口文档

| 文档 | 大小 | 内容 |
|------|------|------|
| [10-API接口文档.md](./10-API接口文档.md) | 14KB | 简化版快速参考 |
| [10-API接口文档-完整版.md](./10-API接口文档-完整版.md) | 24KB | 认证/项目/合同/采购核心API |
| [10.2-API接口文档-库存财务用户.md](./10.2-API接口文档-库存财务用户.md) | 22KB | 库存/财务/用户/角色/部门API |
| [10.3-API接口文档-业务模块.md](./10.3-API接口文档-业务模块.md) | 17KB | 批量采购/零星采购/劳务签证等API |
| [10.4-API接口文档-高级功能.md](./10.4-API接口文档-高级功能.md) | 20KB | 施工管理/竣工/变更/报表/人事等API |

### 文档统计

- **总大小**: 316KB
- **总行数**: 10,918行
- **覆盖范围**: 347个API接口、25+张数据表、50+权限代码

---

## 🔑 核心技术特性

### 认证系统
- JWT Token，30天有效期
- 滑动过期机制（剩余<1小时自动刷新）
- 登录失败锁定（5次错误锁定30分钟）
- 短信验证码（60秒冷却，5分钟有效）

### 审批流程
- 21种审批类型
- 3种审批流程（单步、双步、项目审批）
- 审批历史追溯
- 消息通知

### 权限系统
- RBAC角色权限模型
- 8种预置角色
- 50+权限代码
- 前后端双重校验

### 数据库
- SQLite + better-sqlite3
- 25+张核心业务表
- 完整索引策略
- 事务支持

---

## 📊 系统规模

| 指标 | 数量 |
|------|------|
| 后端路由文件 | 29个 |
| API接口总数 | 347个 |
| 前端页面 | 57个 |
| 数据表 | 25+张 |
| 权限代码 | 50+个 |
| 审批类型 | 21种 |
| 预置角色 | 8种 |

---

## 🔗 相关链接

- **GitHub**: https://github.com/SheridanLu/MOCHU-OA-NEWTEST1
- **在线文档**: https://github.com/SheridanLu/MOCHU-OA-NEWTEST1/tree/main/docs
