# 10 - API接口文档

## 基础信息

- **Base URL**: `http://mochu.group/api`
- **认证方式**: JWT Bearer Token
- **请求格式**: JSON
- **响应格式**: JSON

## 通用响应格式

### 成功响应
```json
{
  "success": true,
  "message": "操作成功",
  "data": { ... }
}
```

### 错误响应
```json
{
  "success": false,
  "message": "错误信息"
}
```

### 认证头
```
Authorization: Bearer <token>
```

---

## 1. 认证接口 (/api/auth)

### 1.1 检查用户是否存在
```
POST /api/auth/check-user
```

**请求体:**
```json
{
  "account": "username"
}
```

**响应:**
```json
{
  "success": true,
  "exists": true,
  "loginMethods": ["password", "sms"]
}
```

---

### 1.2 密码登录
```
POST /api/auth/login-password
```

**请求体:**
```json
{
  "account": "username",
  "password": "password"
}
```

**响应:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "administrator",
    "real_name": "管理员",
    "phone": "13800138000",
    "email": "admin@mochu.group"
  }
}
```

---

### 1.3 发送短信验证码
```
POST /api/auth/send-sms
```

**请求体:**
```json
{
  "phone": "13800138000"
}
```

---

### 1.4 短信登录
```
POST /api/auth/login-sms
```

**请求体:**
```json
{
  "phone": "13800138000",
  "code": "123456"
}
```

---

### 1.5 验证Token
```
GET /api/auth/verify
Authorization: Bearer <token>
```

**响应:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "administrator"
  }
}
```

---

## 2. 项目管理接口 (/api/projects)

### 2.1 获取项目列表
```
GET /api/projects?type=entity&page=1&pageSize=20
Authorization: Bearer <token>
```

**查询参数:**
- `type`: 项目类型 (entity/virtual)
- `status`: 项目状态
- `keyword`: 搜索关键词
- `page`: 页码
- `pageSize`: 每页数量

**响应:**
```json
{
  "success": true,
  "data": {
    "list": [
      {
        "id": 1,
        "project_no": "PRJ-2026-001",
        "name": "某某项目",
        "type": "entity",
        "status": "active",
        "customer": "客户名称",
        "contract_amount": 1000000,
        "project_manager_name": "张三"
      }
    ],
    "total": 100,
    "page": 1,
    "pageSize": 20
  }
}
```

---

### 2.2 创建项目
```
POST /api/projects
Authorization: Bearer <token>
```

**请求体:**
```json
{
  "name": "项目名称",
  "type": "entity",
  "customer": "客户名称",
  "contract_amount": 1000000,
  "project_manager_id": 1,
  "start_date": "2026-01-01",
  "end_date": "2026-12-31"
}
```

---

### 2.3 获取项目详情
```
GET /api/projects/:id
Authorization: Bearer <token>
```

---

### 2.4 更新项目
```
PUT /api/projects/:id
Authorization: Bearer <token>
```

---

### 2.5 删除项目
```
DELETE /api/projects/:id
Authorization: Bearer <token>
```

---

### 2.6 虚拟项目转实体
```
POST /api/projects/:id/convert-with-approval
Authorization: Bearer <token>
```

---

## 3. 合同管理接口 (/api/contracts)

### 3.1 获取合同列表
```
GET /api/contracts?type=income&page=1&pageSize=20
Authorization: Bearer <token>
```

**查询参数:**
- `type`: 合同类型 (income/expense)
- `project_id`: 项目ID
- `status`: 合同状态
- `keyword`: 搜索关键词

---

### 3.2 创建收入合同
```
POST /api/contracts/income
Authorization: Bearer <token>
```

**请求体:**
```json
{
  "project_id": 1,
  "party_a": "甲方名称",
  "party_b": "乙方名称",
  "contract_amount": 1000000,
  "sign_date": "2026-01-01",
  "start_date": "2026-01-01",
  "end_date": "2026-12-31"
}
```

---

### 3.3 创建支出合同
```
POST /api/contracts/expense
Authorization: Bearer <token>
```

**请求体:**
```json
{
  "project_id": 1,
  "supplier_id": 1,
  "party_a": "甲方名称",
  "party_b": "乙方名称",
  "total_amount": 500000,
  "contract_category": "equipment",
  "contract_items": [
    {
      "item_name": "设备名称",
      "quantity": 1,
      "unit_price": 500000
    }
  ]
}
```

---

### 3.4 获取供应商列表
```
GET /api/contracts/suppliers
Authorization: Bearer <token>
```

---

### 3.5 创建供应商
```
POST /api/contracts/suppliers
Authorization: Bearer <token>
```

**请求体:**
```json
{
  "name": "供应商名称",
  "contact_person": "联系人",
  "phone": "13800138000",
  "email": "supplier@example.com",
  "address": "地址",
  "bank_name": "银行名称",
  "bank_account": "银行账号",
  "tax_no": "税号"
}
```

---

### 3.6 提交合同审批
```
POST /api/contracts/:id/submit
Authorization: Bearer <token>
```

---

### 3.7 审批通过
```
POST /api/contracts/:id/approve
Authorization: Bearer <token>
```

**请求体:**
```json
{
  "comment": "审批意见"
}
```

---

### 3.8 审批拒绝
```
POST /api/contracts/:id/reject
Authorization: Bearer <token>
```

**请求体:**
```json
{
  "comment": "拒绝原因"
}
```

---

## 4. 采购管理接口 (/api/purchase)

### 4.1 采购清单列表
```
GET /api/purchase-lists?project_id=1&page=1
Authorization: Bearer <token>
```

---

### 4.2 创建采购清单
```
POST /api/purchase-lists
Authorization: Bearer <token>
```

**请求体:**
```json
{
  "project_id": 1,
  "name": "采购清单名称"
}
```

---

### 4.3 获取采购清单详情
```
GET /api/purchase-lists/:id
Authorization: Bearer <token>
```

---

### 4.4 添加采购清单项
```
POST /api/purchase-lists/:id/items
Authorization: Bearer <token>
```

**请求体:**
```json
{
  "category": "material",
  "material_name": "材料名称",
  "specification": "规格型号",
  "unit": "个",
  "quantity": 100
}
```

---

### 4.5 提交采购清单审批
```
POST /api/purchase-lists/:id/submit
Authorization: Bearer <token>
```

---

### 4.6 零星采购列表
```
GET /api/purchase/sporadic?project_id=1
Authorization: Bearer <token>
```

---

### 4.7 创建零星采购
```
POST /api/purchase/sporadic
Authorization: Bearer <token>
```

**请求体:**
```json
{
  "project_id": 1,
  "contract_id": 1,
  "tax_rate": 13,
  "items": [
    {
      "item_name": "物品名称",
      "quantity": 1,
      "unit_price": 100
    }
  ],
  "total_amount": 100,
  "attachments": []
}
```

---

## 5. 库存管理接口 (/api/stock)

### 5.1 材料基准价列表
```
GET /api/materials/base?page=1&pageSize=20
Authorization: Bearer <token>
```

---

### 5.2 添加材料基准价
```
POST /api/materials/base
Authorization: Bearer <token>
```

**请求体:**
```json
{
  "name": "材料名称",
  "specification": "规格",
  "unit": "个",
  "base_price": 100,
  "warning_threshold": 1
}
```

---

### 5.3 入库单列表
```
GET /api/stock/in?page=1
Authorization: Bearer <token>
```

---

### 5.4 创建入库单
```
POST /api/stock/in
Authorization: Bearer <token>
```

**请求体:**
```json
{
  "project_id": 1,
  "supplier_id": 1,
  "items": [
    {
      "material_id": 1,
      "quantity": 100,
      "unit_price": 50,
      "total_price": 5000
    }
  ]
}
```

---

### 5.5 出库单列表
```
GET /api/stock/out?page=1
Authorization: Bearer <token>
```

---

### 5.6 创建出库单
```
POST /api/stock/out
Authorization: Bearer <token>
```

**请求体:**
```json
{
  "project_id": 1,
  "items": [
    {
      "material_id": 1,
      "quantity": 50
    }
  ]
}
```

---

### 5.7 提交出库审批
```
POST /api/stock/out/:id/submit
Authorization: Bearer <token>
```

---

## 6. 财务管理接口 (/api/payment)

### 6.1 材料付款列表
```
GET /api/payment/material?page=1
Authorization: Bearer <token>
```

---

### 6.2 创建材料付款申请
```
POST /api/payment/material
Authorization: Bearer <token>
```

**请求体:**
```json
{
  "project_id": 1,
  "contract_id": 1,
  "supplier_id": 1,
  "payment_amount": 100000,
  "payment_date": "2026-01-01",
  "payment_method": "bank_transfer"
}
```

---

### 6.3 劳务付款列表
```
GET /api/payment/labor?page=1
Authorization: Bearer <token>
```

---

### 6.4 创建劳务付款申请
```
POST /api/payment/labor
Authorization: Bearer <token>
```

---

### 6.5 付款审批
```
POST /api/payment/material/:id/approve
Authorization: Bearer <token>
```

---

## 7. 审批管理接口 (/api/approval)

### 7.1 待审批列表
```
GET /api/approval/pending?page=1&pageSize=20
Authorization: Bearer <token>
```

**响应:**
```json
{
  "success": true,
  "data": {
    "list": [
      {
        "id": 1,
        "approval_source": "purchase_list",
        "source_name": "采购清单",
        "project_name": "项目名称",
        "submitter_name": "提交人",
        "created_at": "2026-01-01 10:00:00",
        "status": "pending",
        "current_approver_name": "当前审批人"
      }
    ],
    "total": 10
  }
}
```

---

### 7.2 我提交的审批
```
GET /api/approval/my-submissions?page=1
Authorization: Bearer <token>
```

---

### 7.3 我已审批的
```
GET /api/approval/my-approved?page=1
Authorization: Bearer <token>
```

---

### 7.4 审批详情
```
GET /api/approval/project/:projectId
Authorization: Bearer <token>
```

---

## 8. 用户管理接口 (/api/users)

### 8.1 用户列表
```
GET /api/users?page=1&pageSize=20
Authorization: Bearer <token>
```

---

### 8.2 创建用户
```
POST /api/users
Authorization: Bearer <token>
```

**请求体:**
```json
{
  "username": "username",
  "password": "password",
  "real_name": "真实姓名",
  "phone": "13800138000",
  "email": "user@example.com",
  "department_id": 1,
  "role_ids": [1, 2]
}
```

---

### 8.3 更新用户
```
PUT /api/users/:id
Authorization: Bearer <token>
```

---

### 8.4 删除用户
```
DELETE /api/users/:id
Authorization: Bearer <token>
```

---

### 8.5 修改密码
```
PUT /api/users/:id/password
Authorization: Bearer <token>
```

**请求体:**
```json
{
  "old_password": "旧密码",
  "new_password": "新密码"
}
```

---

## 9. 角色管理接口 (/api/roles)

### 9.1 角色列表
```
GET /api/roles
Authorization: Bearer <token>
```

---

### 9.2 创建角色
```
POST /api/roles
Authorization: Bearer <token>
```

**请求体:**
```json
{
  "name": "角色名称",
  "code": "ROLE_CODE",
  "permissions": ["permission1", "permission2"]
}
```

---

### 9.3 更新角色
```
PUT /api/roles/:id
Authorization: Bearer <token>
```

---

### 9.4 删除角色
```
DELETE /api/roles/:id
Authorization: Bearer <token>
```

---

## 10. 权限管理接口 (/api/permissions)

### 10.1 权限列表
```
GET /api/permissions
Authorization: Bearer <token>
```

---

### 10.2 用户权限
```
GET /api/permissions/user/:userId
Authorization: Bearer <token>
```

---

## 11. 部门管理接口 (/api/departments)

### 11.1 部门树
```
GET /api/departments
Authorization: Bearer <token>
```

---

### 11.2 创建部门
```
POST /api/departments
Authorization: Bearer <token>
```

**请求体:**
```json
{
  "name": "部门名称",
  "parent_id": 1,
  "manager_id": 1
}
```

---

## 12. 其他接口

### 12.1 待办事项 (/api/todos)
```
GET /api/todos
POST /api/todos
PUT /api/todos/:id
DELETE /api/todos/:id
```

### 12.2 公告管理 (/api/announcements)
```
GET /api/announcements
POST /api/announcements
PUT /api/announcements/:id
DELETE /api/announcements/:id
```

### 12.3 通讯录 (/api/directory)
```
GET /api/directory
GET /api/directory/departments
```

### 12.4 审计日志 (/api/audit)
```
GET /api/audit/logs
GET /api/audit/stats
```

### 12.5 报表中心 (/api/reports)
```
GET /api/reports/financial
GET /api/reports/project
GET /api/reports/purchase
```

---

## HTTP状态码说明

| 状态码 | 说明 |
|-------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未认证或token过期 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 409 | 资源冲突 |
| 429 | 请求过于频繁 |
| 500 | 服务器内部错误 |

---

## 权限代码列表

| 权限代码 | 说明 |
|---------|------|
| `project:view` | 查看项目 |
| `project:create` | 创建项目 |
| `project:edit` | 编辑项目 |
| `project:delete` | 删除项目 |
| `project:approve` | 审批项目 |
| `contract:view` | 查看合同 |
| `contract:create` | 创建合同 |
| `contract:edit` | 编辑合同 |
| `contract:delete` | 删除合同 |
| `contract:approve` | 审批合同 |
| `purchase:view` | 查看采购 |
| `purchase:create` | 创建采购 |
| `purchase:edit` | 编辑采购 |
| `purchase:delete` | 删除采购 |
| `purchase:approve` | 审批采购 |
| `supplier:create` | 创建供应商 |
| `material:create` | 创建材料 |
| `material:edit` | 编辑材料 |
| `material:delete` | 删除材料 |
| `material:approve` | 审批材料变更 |
| `payment:approve` | 审批付款 |
| `inventory:view` | 查看库存 |
| `inventory:in` | 入库操作 |
| `inventory:out` | 出库操作 |
| `inventory:adjust` | 库存调整 |
| `finance:view` | 查看财务 |
| `finance:budget` | 预算管理 |
| `finance:payment` | 付款管理 |
| `user:view` | 查看用户 |
| `user:create` | 创建用户 |
| `user:edit` | 编辑用户 |
| `user:delete` | 删除用户 |
| `role:view` | 查看角色 |
| `role:create` | 创建角色 |
| `role:edit` | 编辑角色 |
| `role:delete` | 删除角色 |
| `system:manage` | 系统管理 |
| `data:view` | 查看数据 |
| `data:export` | 导出数据 |
| `data:import` | 导入数据 |

---

## 注意事项

1. **认证**: 除了登录接口，其他所有接口都需要在请求头中携带有效的JWT Token
2. **权限**: 部分接口需要特定权限，权限不足会返回403错误
3. **滑动过期**: Token有效期为30天，剩余时间<1小时时会自动刷新
4. **请求频率**: 请勿过于频繁调用API，避免触发429错误
5. **数据格式**: 所有日期字段使用ISO 8601格式 (YYYY-MM-DD)
6. **金额格式**: 所有金额字段使用数字类型，单位为元
