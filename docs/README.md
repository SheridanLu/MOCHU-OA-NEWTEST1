# MOCHU-OA 施工管理系统技术文档

## 文档版本
- **版本**: v1.0.0
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
| **认证** | JWT (JSON Web Token) | 无状态认证 |
| **密码加密** | bcryptjs | 密码哈希 |

### 项目结构

```
MOCHU-OA-NEWTEST1/
├── backend/                 # 后端代码
│   ├── routes/             # API路由
│   │   ├── auth.js         # 认证路由
│   │   ├── project.js      # 项目管理
│   │   ├── contract.js     # 合同管理
│   │   ├── purchase.js     # 采购管理
│   │   ├── stock.js        # 库存管理
│   │   ├── payment.js      # 财务管理
│   │   ├── approval.js     # 审批流程
│   │   └── ...             # 其他路由
│   ├── services/           # 业务服务
│   │   ├── stockService.js
│   │   ├── reportService.js
│   │   └── ...
│   ├── models/             # 数据模型
│   │   ├── database.js     # 数据库连接
│   │   ├── User.js         # 用户模型
│   │   └── approval.js     # 审批模型
│   ├── middleware/         # 中间件
│   │   ├── auth.js         # 认证中间件
│   │   └── permission.js   # 权限中间件
│   ├── database.db         # SQLite数据库文件
│   └── server.js           # 服务入口
├── frontend/               # 前端代码
│   ├── src/
│   │   ├── pages/         # 页面组件
│   │   │   ├── login/     # 登录页
│   │   │   ├── project/   # 项目管理
│   │   │   ├── contract/  # 合同管理
│   │   │   ├── purchase/  # 采购管理
│   │   │   ├── stock/     # 库存管理
│   │   │   ├── approval/  # 审批管理
│   │   │   └── ...
│   │   ├── services/      # API服务
│   │   ├── components/    # 公共组件
│   │   ├── utils/         # 工具函数
│   │   └── App.jsx        # 应用入口
│   └── public/            # 静态资源
└── docs/                   # 技术文档
    ├── 01-系统架构.md
    ├── 02-认证授权.md
    ├── 03-项目管理.md
    ├── 04-合同管理.md
    ├── 05-采购管理.md
    ├── 06-库存管理.md
    ├── 07-财务管理.md
    ├── 08-审批流程.md
    ├── 09-权限系统.md
    └── 10-API接口文档.md
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

| 模块 | 说明 | 文档 |
|------|------|------|
| 认证授权 | JWT认证、权限管理、滑动过期 | [02-认证授权.md](./02-认证授权.md) |
| 项目管理 | 项目CRUD、虚拟项目、项目审批 | [03-项目管理.md](./03-项目管理.md) |
| 合同管理 | 收入/支出合同、合同审批、供应商管理 | [04-合同管理.md](./04-合同管理.md) |
| 采购管理 | 采购清单、零星采购、批量采购 | [05-采购管理.md](./05-采购管理.md) |
| 库存管理 | 材料入库、出库、库存盘点 | [06-库存管理.md](./06-库存管理.md) |
| 财务管理 | 付款管理、对账单、财务报表 | [07-财务管理.md](./07-财务管理.md) |
| 审批流程 | 21种审批类型、多级审批 | [08-审批流程.md](./08-审批流程.md) |
| 权限系统 | RBAC角色权限、菜单权限 | [09-权限系统.md](./09-权限系统.md) |

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

## 文档目录

1. [系统架构](./01-系统架构.md)
2. [认证授权](./02-认证授权.md)
3. [项目管理](./03-项目管理.md)
4. [合同管理](./04-合同管理.md)
5. [采购管理](./05-采购管理.md)
6. [库存管理](./06-库存管理.md)
7. [财务管理](./07-财务管理.md)
8. [审批流程](./08-审批流程.md)
9. [权限系统](./09-权限系统.md)
10. [API接口文档](./10-API接口文档.md)
