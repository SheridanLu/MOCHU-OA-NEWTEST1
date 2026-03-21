# 11 - 完整API路由清单

> 本文档记录MOCHU-OA系统所有424个API接口的完整清单

---

## 接口统计总览

| 模块 | 文件 | 接口数 |
|------|------|--------|
| 认证 | auth.js | 7 |
| 用户 | user.js | 8 |
| 角色 | role.js | 8 |
| 部门 | department.js | 7 |
| 权限 | permission.js | 10 |
| 项目 | project.js | 19 |
| 合同 | contract.js | 32 |
| 采购 | purchase.js | 56 |
| 批量采购 | batchPurchase.js | 10 |
| 零星采购 | sporadicPurchase.js | 12 |
| 材料 | material.js | 15 |
| 库存 | stock.js | 41 |
| 付款 | payment.js | 21 |
| 收款 | receipt.js | 4 |
| 收入对账单 | incomeStatement.js | 13 |
| 审批 | approval.js | 8 |
| 施工 | construction.js | 39 |
| 竣工 | completion.js | 25 |
| 变更 | change.js | 25 |
| 报表 | report.js | 6 |
| 劳务签证 | laborVisa.js | 7 |
| 超量审批 | overageApproval.js | 4 |
| 进度预警 | progressAlert.js | 7 |
| 通讯录 | directory.js | 3 |
| 邮件 | email.js | 8 |
| 人事 | hr.js | 10 |
| 审计 | audit.js | 9 |
| 公告 | announcement.js | 6 |
| 待办 | todo.js | 4 |
| **总计** | - | **424** |

---

## 1. 认证接口 (auth.js) - 7个

```
POST   /api/auth/check-user          # 检查用户是否存在
POST   /api/auth/login-password      # 密码登录
POST   /api/auth/send-sms            # 发送短信验证码
POST   /api/auth/login-sms           # 短信验证码登录
GET    /api/auth/verify              # 验证Token
POST   /api/auth/logout              # 登出
GET    /api/auth/permissions         # 获取当前用户权限
```

---

## 2. 用户接口 (user.js) - 8个

```
GET    /api/users                    # 用户列表
GET    /api/users/:id                # 用户详情
POST   /api/users                    # 创建用户
PUT    /api/users/:id                # 更新用户
DELETE /api/users/:id                # 删除用户
PUT    /api/users/batch-status       # 批量更新状态
GET    /api/users/check-username     # 检查用户名
PUT    /api/users/:id/status         # 更新用户状态
```

---

## 3. 角色接口 (role.js) - 8个

```
GET    /api/roles                    # 角色列表
GET    /api/roles/permissions        # 所有权限列表
GET    /api/roles/:id                # 角色详情
POST   /api/roles                    # 创建角色
PUT    /api/roles/:id                # 更新角色
PUT    /api/roles/:id/permissions    # 更新角色权限
DELETE /api/roles/:id                # 删除角色
GET    /api/roles/:id/users          # 角色下的用户
```

---

## 4. 部门接口 (department.js) - 7个

```
GET    /api/departments              # 部门列表
GET    /api/departments/:id          # 部门详情
POST   /api/departments              # 创建部门
PUT    /api/departments/:id          # 更新部门
DELETE /api/departments/:id          # 删除部门
GET    /api/departments/:id/employees # 部门员工
GET    /api/departments/tree-options/list # 部门树选项
```

---

## 5. 权限接口 (permission.js) - 10个

```
GET    /api/permissions              # 权限列表
GET    /api/permissions/roles        # 角色权限列表
GET    /api/permissions/role/:roleId # 角色权限详情
PUT    /api/permissions/role/:roleId # 更新角色权限
GET    /api/permissions/user/:userId # 用户权限
PUT    /api/permissions/user/:userId # 更新用户权限
GET    /api/permissions/users        # 用户权限列表
POST   /api/permissions/roles        # 创建角色
PUT    /api/permissions/roles/:roleId # 更新角色
DELETE /api/permissions/roles/:roleId # 删除角色
```

---

## 6. 项目接口 (project.js) - 19个

```
GET    /api/projects/cost-targets    # 成本目标列表
GET    /api/projects/preview-no      # 预览项目编号
GET    /api/projects                 # 项目列表
GET    /api/projects/:id             # 项目详情
POST   /api/projects                 # 创建项目
POST   /api/projects/virtual         # 创建虚拟项目
PUT    /api/projects/:id             # 更新项目
POST   /api/projects/:id/convert     # 转换虚拟项目
GET    /api/projects/virtual         # 虚拟项目列表
POST   /api/projects/virtual/convert # 批量转换虚拟项目
POST   /api/projects/:id/abort       # 中止项目
DELETE /api/projects/:id             # 删除项目
GET    /api/projects/stats/overview  # 项目统计概览
POST   /api/projects/:id/convert-with-approval # 带审批转换
POST   /api/projects/:id/abort-with-approval   # 带审批中止
POST   /api/projects/:id/process-conversion    # 处理转换审批
POST   /api/projects/:id/process-abort         # 处理中止审批
GET    /api/projects/:id/conversion-status     # 转换状态
GET    /api/projects/:id/abort-status          # 中止状态
```

---

## 7. 合同接口 (contract.js) - 32个

```
GET    /api/contracts/preview-no     # 预览合同编号
GET    /api/contracts                # 合同列表
GET    /api/contracts/suppliers      # 供应商列表
GET    /api/contracts/:id            # 合同详情
POST   /api/contracts/suppliers      # 创建供应商
POST   /api/contracts/income         # 创建收入合同
POST   /api/contracts/expense        # 创建支出合同
PUT    /api/contracts/:id            # 更新合同
DELETE /api/contracts/:id            # 删除合同
POST   /api/contracts/:id/submit     # 提交审批
POST   /api/contracts/:id/approve    # 审批通过
POST   /api/contracts/:id/reject     # 审批拒绝
GET    /api/contracts/:id/history    # 审批历史
GET    /api/contracts/stats/overview # 合同统计
POST   /api/contracts/expense/overage-check  # 超量检查
POST   /api/contracts/expense/overcheck      # 超量申请
GET    /api/contracts/price-warnings # 价格预警列表
PUT    /api/contracts/price-warnings/:id/handle # 处理价格预警
GET    /api/contracts/:id/suppliers  # 合同供应商
GET    /api/contracts/projects/:projectId/purchase-lists # 项目采购清单
GET    /api/contracts/purchase-lists/:listId/items # 采购清单项
GET    /api/contracts/overcheck      # 超量审批列表
GET    /api/contracts/:id/check      # 合同检查
POST   /api/contracts/expense/:id/overcheck-apply # 支出合同超量申请
GET    /api/contracts/material-base-prices # 材料基准价
POST   /api/contracts/:id/overcheck  # 提交超量审批
POST   /api/contracts/:id/overcheck/approve # 超量审批通过
POST   /api/contracts/:id/overcheck/reject  # 超量审批拒绝
GET    /api/contracts/overcheck/pending      # 待审批超量
GET    /api/contracts/:id/overcheck # 超量审批详情
```

---

## 8. 采购接口 (purchase.js) - 56个

详见API文档第5章

---

## 9. 批量采购接口 (batchPurchase.js) - 10个

```
GET    /api/purchase/batch/batch     # 批量采购列表
POST   /api/purchase/batch/batch     # 创建批量采购
GET    /api/purchase/batch/batch/:id # 批量采购详情
PUT    /api/purchase/batch/batch/:id # 更新批量采购
DELETE /api/purchase/batch/batch/:id # 删除批量采购
POST   /api/purchase/batch/batch/:id/submit   # 提交审批
POST   /api/purchase/batch/batch/:id/approve  # 审批通过
POST   /api/purchase/batch/batch/:id/reject   # 审批拒绝
GET    /api/purchase/batch/batch/contracts/expense # 支出合同列表
GET    /api/purchase/batch/batch/contracts/:contractId/purchase-list # 合同采购清单
```

---

## 10. 零星采购接口 (sporadicPurchase.js) - 12个

```
GET    /api/sporadic-purchase        # 零星采购列表
GET    /api/sporadic-purchase/:id    # 零星采购详情
GET    /api/sporadic-purchase/:id/items      # 零星采购项
POST   /api/sporadic-purchase/check-excessive # 检查超额
POST   /api/sporadic-purchase        # 创建零星采购
PUT    /api/sporadic-purchase/:id    # 更新零星采购
DELETE /api/sporadic-purchase/:id    # 删除零星采购
POST   /api/sporadic-purchase/batch-delete    # 批量删除
POST   /api/sporadic-purchase/:id/submit      # 提交审批
POST   /api/sporadic-purchase/:id/approve     # 审批通过
POST   /api/sporadic-purchase/:id/reject      # 审批拒绝
GET    /api/sporadic-purchase/monthly-stats   # 月度统计
```

---

## 11. 材料接口 (material.js) - 15个

```
GET    /api/materials/base           # 材料基准价列表
GET    /api/materials/:id            # 材料详情
POST   /api/materials                # 创建材料
PUT    /api/materials/:id            # 更新材料
DELETE /api/materials/:id            # 删除材料
PUT    /api/materials/base-price     # 更新基准价
POST   /api/materials/price-warning  # 创建价格预警
PUT    /api/materials/:id/overcheck  # 超量检查
POST   /api/materials/:id/price-check # 价格检查
POST   /api/materials/:id/suppliers  # 添加材料供应商
PUT    /api/materials/suppliers      # 更新材料供应商
POST   /api/materials/contracts/expense # 创建支出合同
GET    /api/materials/price-history/:id # 价格历史
GET    /api/materials/export         # 导出材料
POST   /api/materials/import         # 导入材料
```

---

## 12. 库存接口 (stock.js) - 41个

详见API文档第5章

---

## 13-29. 其他模块接口

详见对应API文档章节

---

## HTTP状态码说明

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未授权 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 409 | 资源冲突 |
| 429 | 请求过于频繁 |
| 500 | 服务器内部错误 |

---

## 通用响应格式

### 成功响应
```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}
```

### 错误响应
```json
{
  "success": false,
  "message": "错误信息",
  "code": "ERROR_CODE"
}
```

### 分页响应
```json
{
  "success": true,
  "data": {
    "list": [...],
    "total": 100,
    "page": 1,
    "pageSize": 20
  }
}
```
