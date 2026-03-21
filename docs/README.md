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

## 🚧 待开发功能（问题传报需求）

> 根据2026年3月13日问题传报文档，以下功能待开发实现

### P0 - 高优先级

| 功能 | 说明 | 状态 |
|------|------|------|
| 支出合同扩展字段 | 运输方式、接货人、交货差、交货期限、结算方式、验收负责人、质保期 | ❌ 待开发 |
| 零星采购税点 | tax_type, tax_rate 字段（0%/1%/3%/6%/9%/13%） | ❌ 待开发 |
| 现场签证关联合同 | contract_id 字段，关联支出合同 | ❌ 待开发 |

### P1 - 中优先级

| 功能 | 说明 | 状态 |
|------|------|------|
| 附件上传通用模块 | 统一附件管理表和API | ❌ 待开发 |
| 现场签证附件 | attachment 字段，支持上传 | ❌ 待开发 |
| 甲方需求变更附件 | attachment 字段，支持上传 | ❌ 待开发 |
| 超量采购变更附件 | attachment 字段，支持上传 | ❌ 待开发 |

### P2 - 低优先级

| 功能 | 说明 | 状态 |
|------|------|------|
| 合同模板管理 | 模板表、CRUD接口、变量替换 | ❌ 待开发 |
| 根据模板生成合同 | 自动填充变量生成合同 | ❌ 待开发 |

### 已实现功能（21项）✅

| 序号 | 功能 | API |
|------|------|-----|
| 1 | 虚拟项目转实体项目 | `POST /api/projects/:id/convert` |
| 2 | 虚拟项目中止功能 | `POST /api/projects/:id/abort-with-approval` |
| 3 | 项目立项审批流程 | 采购员→财务→总经理 |
| 4 | 审批详情查看 | `GET /api/approvals/project/:projectId` |
| 5 | 供应商创建（含联系人区域） | `POST /api/contracts/suppliers` |
| 6 | 采购清单分类（设备/材料） | category 字段 |
| 7 | 材料基准价分类 | category + 规格验证 |
| 8 | 超量审批功能 | `POST /api/overage-approvals` |
| 9 | 零星采购功能 | `POST /api/sporadic-purchases` |
| 10 | 物资领用功能 | `POST /api/stock/requisitions` |
| 11 | 入库单合计功能 | total_quantity, total_amount |
| 12 | 物资入库审批 | 入库确认 + 库存更新 |
| 13 | 现场签证管理 | `POST /api/changes/visa` |
| 14 | 甲方需求变更 | `POST /api/changes/owner-changes` |
| 15 | 劳务签证 | `POST /api/labor-visas` |
| 16 | 偏差预警功能 | `GET /api/progress-alerts` |
| 17 | 里程碑甘特图 | `GET /api/construction/tasks/gantt/:projectId` |
| 18 | 收入合同拆分 | `POST /api/income-statements/generate` |
| 19 | 库存查询高级功能 | `GET /api/stock/query/statistics` |
| 20 | 权限控制（RBAC） | checkPermission 中间件 |
| 21 | 竣工管理 | `/api/completion/*` |

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
| [10.5-API接口文档-补充.md](./10.5-API接口文档-补充.md) | 10KB | 甘特图/任务依赖/库存查询API |
| [11-完整API路由清单.md](./11-完整API路由清单.md) | 10KB | 424个接口完整清单 |
| [12-完整数据库表清单.md](./12-完整数据库表清单.md) | 6KB | 68张表完整清单 |
| [13-问题传报核实清单.md](./13-问题传报核实清单.md) | 8KB | 21项已实现/4项未实现 |

### 文档统计

- **总大小**: 320KB+
- **总行数**: 11,000+行
- **覆盖范围**: 424个API接口、68张数据表、50+权限代码
- **问题传报核实**: 21项已实现、4项未实现、1项部分实现

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
