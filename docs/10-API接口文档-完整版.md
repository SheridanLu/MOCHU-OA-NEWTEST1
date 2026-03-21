# 10 - API接口完整文档

## 基础信息

- **Base URL**: `http://mochu.group/api`
- **认证方式**: JWT Bearer Token (滑动过期，30天有效期)
- **请求格式**: JSON
- **响应格式**: JSON
- **字符编码**: UTF-8

## 通用说明

### 认证头
```
Authorization: Bearer <token>
```

### 通用响应格式

#### 成功响应
```json
{
  "success": true,
  "message": "操作成功",
  "data": {}
}
```

#### 分页响应
```json
{
  "success": true,
  "data": {
    "list": [],
    "total": 100,
    "page": 1,
    "pageSize": 20,
    "totalPages": 5
  }
}
```

#### 错误响应
```json
{
  "success": false,
  "message": "错误信息",
  "code": "ERROR_CODE"
}
```

### HTTP状态码

| 状态码 | 说明 | 场景 |
|-------|------|------|
| 200 | 成功 | 请求成功 |
| 201 | 已创建 | POST创建资源成功 |
| 400 | 请求错误 | 参数缺失或格式错误 |
| 401 | 未认证 | Token无效或已过期 |
| 403 | 无权限 | 有Token但无操作权限 |
| 404 | 未找到 | 资源不存在 |
| 409 | 冲突 | 资源已存在 |
| 429 | 请求过多 | 登录失败被锁定 |
| 500 | 服务器错误 | 服务器内部错误 |

### 滑动过期机制

- Token有效期：30天
- 自动刷新：当Token剩余有效期 < 1小时，服务器会在响应头返回新Token
- 响应头：`X-New-Token: <new_token>`
- 前端自动检测并更新localStorage中的token

---

# 1. 认证接口 (/api/auth)

## 1.1 检查用户是否存在

### 请求
```
POST /api/auth/check-user
Content-Type: application/json
```

### 请求体
```json
{
  "account": "administrator"
}
```

### 参数说明
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| account | string | 是 | 用户名或手机号 |

### 响应

**用户存在:**
```json
{
  "success": true,
  "exists": true,
  "loginMethods": ["password", "sms"]
}
```

**用户不存在:**
```json
{
  "success": true,
  "exists": false,
  "loginMethods": []
}
```

---

## 1.2 密码登录

### 请求
```
POST /api/auth/login-password
Content-Type: application/json
```

### 请求体
```json
{
  "account": "administrator",
  "password": "999998"
}
```

### 参数说明
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| account | string | 是 | 用户名或手机号 |
| password | string | 是 | 密码 |

### 响应

**登录成功:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "administrator",
    "real_name": "系统管理员",
    "phone": "13800138000",
    "email": "admin@mochu.group",
    "status": "active"
  }
}
```

**密码错误:**
```json
{
  "success": false,
  "message": "账号或密码错误，还剩 4 次尝试机会"
}
```

**账号被锁定:**
```json
{
  "success": false,
  "message": "账号已被锁定，请在 25 分钟后重试",
  "lockTime": 25
}
```

### 验证规则
- 连续5次密码错误，账号锁定30分钟
- Token有效期30天，支持滑动过期

---

## 1.3 发送短信验证码

### 请求
```
POST /api/auth/send-sms
Content-Type: application/json
```

### 请求体
```json
{
  "phone": "13800138000"
}
```

### 参数说明
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| phone | string | 是 | 手机号（1开头的11位数字） |

### 响应
```json
{
  "success": true,
  "message": "验证码已发送"
}
```

### 验证规则
- 同一手机号60秒内只能发送一次
- 验证码5分钟内有效

---

## 1.4 短信登录

### 请求
```
POST /api/auth/login-sms
Content-Type: application/json
```

### 请求体
```json
{
  "phone": "13800138000",
  "code": "123456"
}
```

### 参数说明
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| phone | string | 是 | 手机号 |
| code | string | 是 | 6位验证码 |

### 响应
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { ... }
}
```

---

## 1.5 验证Token

### 请求
```
GET /api/auth/verify
Authorization: Bearer <token>
```

### 响应

**Token有效:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "administrator",
    "role": "GM"
  }
}
```

**Token无效:**
```json
{
  "success": false,
  "message": "令牌无效或已过期，请重新登录"
}
```

---

# 2. 项目管理接口 (/api/projects)

## 2.1 获取项目列表

### 请求
```
GET /api/projects?type=entity&status=active&keyword=测试&page=1&pageSize=20
Authorization: Bearer <token>
```

### 查询参数
| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| type | string | 否 | - | entity(实体), virtual(虚拟) |
| status | string | 否 | - | active, completed, cancelled |
| keyword | string | 否 | - | 搜索关键词 |
| project_manager_id | number | 否 | - | 项目经理ID |
| page | number | 否 | 1 | 页码 |
| pageSize | number | 否 | 20 | 每页数量(最大100) |

### 响应
```json
{
  "success": true,
  "data": {
    "list": [
      {
        "id": 1,
        "project_no": "PRJ-2026-001",
        "name": "某某施工项目",
        "type": "entity",
        "status": "active",
        "customer": "客户名称",
        "contract_amount": 1000000.00,
        "project_manager_id": 5,
        "project_manager_name": "张三",
        "start_date": "2026-01-01",
        "end_date": "2026-12-31",
        "created_at": "2026-01-01 10:00:00"
      }
    ],
    "total": 100,
    "page": 1,
    "pageSize": 20
  }
}
```

---

## 2.2 创建项目

### 请求
```
POST /api/projects
Authorization: Bearer <token>
Content-Type: application/json
```

### 权限要求
`project:create`

### 请求体
```json
{
  "name": "新项目名称",
  "type": "entity",
  "customer": "客户名称",
  "contract_amount": 1000000,
  "project_manager_id": 5,
  "start_date": "2026-01-01",
  "end_date": "2026-12-31",
  "description": "项目描述",
  "location": "项目地点"
}
```

### 参数说明
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 项目名称，最长100字符 |
| type | string | 是 | entity(实体), virtual(虚拟) |
| customer | string | 否 | 客户名称，最长100字符 |
| contract_amount | number | 否 | 合同金额，精确到分 |
| project_manager_id | number | 否 | 项目经理用户ID |
| start_date | string | 否 | 开始日期，YYYY-MM-DD |
| end_date | string | 否 | 结束日期，YYYY-MM-DD |
| description | string | 否 | 项目描述，最长500字符 |
| location | string | 否 | 项目地点，最长200字符 |

### 响应
```json
{
  "success": true,
  "message": "项目创建成功",
  "data": {
    "id": 10,
    "project_no": "PRJ-2026-010",
    "name": "新项目名称",
    "status": "active"
  }
}
```

---

## 2.3 获取项目详情

### 请求
```
GET /api/projects/:id
Authorization: Bearer <token>
```

### 路径参数
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | number | 是 | 项目ID |

### 响应
```json
{
  "success": true,
  "data": {
    "id": 1,
    "project_no": "PRJ-2026-001",
    "name": "某某施工项目",
    "type": "entity",
    "status": "active",
    "customer": "客户名称",
    "contract_amount": 1000000.00,
    "project_manager_id": 5,
    "project_manager_name": "张三",
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "description": "项目描述",
    "location": "项目地点",
    "created_at": "2026-01-01 10:00:00",
    "updated_at": "2026-01-01 10:00:00"
  }
}
```

---

## 2.4 更新项目

### 请求
```
PUT /api/projects/:id
Authorization: Bearer <token>
Content-Type: application/json
```

### 权限要求
`project:edit`

### 请求体
同创建项目，所有字段可选

### 响应
```json
{
  "success": true,
  "message": "项目更新成功",
  "data": { ... }
}
```

---

## 2.5 删除项目

### 请求
```
DELETE /api/projects/:id
Authorization: Bearer <token>
```

### 权限要求
`project:delete`

### 响应
```json
{
  "success": true,
  "message": "项目已删除"
}
```

### 错误码
- `400`: 项目有关联数据，无法删除
- `404`: 项目不存在

---

## 2.6 虚拟项目转实体（带审批）

### 请求
```
POST /api/projects/:id/convert-with-approval
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

### 权限要求
`project:convert`

### 请求体（FormData）
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| bid_notice_file | file | 是 | 中标通知书文件 |
| actual_contract_amount | number | 是 | 实际合同金额 |
| customer | string | 是 | 客户名称 |
| project_manager_id | number | 是 | 项目经理ID |
| start_date | string | 否 | 开始日期 |
| end_date | string | 否 | 结束日期 |

### 响应
```json
{
  "success": true,
  "message": "虚拟项目转实体申请已提交，等待审批"
}
```

---

# 3. 合同管理接口 (/api/contracts)

## 3.1 获取合同预览编号

### 请求
```
GET /api/contracts/preview-no?type=expense
Authorization: Bearer <token>
```

### 查询参数
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 是 | income(收入), expense(支出) |

### 响应
```json
{
  "success": true,
  "data": {
    "contract_no": "EXP-2026-001"
  }
}
```

---

## 3.2 获取合同列表

### 请求
```
GET /api/contracts?type=income&project_id=1&status=draft&page=1
Authorization: Bearer <token>
```

### 查询参数
| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| type | string | 否 | - | income, expense |
| project_id | number | 否 | - | 项目ID |
| supplier_id | number | 否 | - | 供应商ID |
| status | string | 否 | - | draft, pending, approved, rejected |
| keyword | string | 否 | - | 搜索关键词 |
| page | number | 否 | 1 | 页码 |
| pageSize | number | 否 | 20 | 每页数量 |

### 响应
```json
{
  "success": true,
  "data": {
    "list": [
      {
        "id": 1,
        "contract_no": "INC-2026-001",
        "contract_type": "income",
        "project_id": 1,
        "project_name": "某某项目",
        "party_a": "甲方名称",
        "party_b": "乙方名称",
        "total_amount": 1000000.00,
        "status": "approved",
        "sign_date": "2026-01-01",
        "creator_name": "张三",
        "created_at": "2026-01-01 10:00:00"
      }
    ],
    "total": 50,
    "page": 1,
    "pageSize": 20
  }
}
```

---

## 3.3 创建收入合同

### 请求
```
POST /api/contracts/income
Authorization: Bearer <token>
Content-Type: application/json
```

### 权限要求
`contract:create`

### 请求体
```json
{
  "project_id": 1,
  "party_a": "甲方（客户）名称",
  "party_b": "乙方（本公司）名称",
  "total_amount": 1000000,
  "sign_date": "2026-01-01",
  "start_date": "2026-01-01",
  "end_date": "2026-12-31",
  "payment_terms": "按进度付款",
  "remark": "备注信息",
  "contract_items": [
    {
      "item_name": "设备费",
      "quantity": 1,
      "unit_price": 800000
    },
    {
      "item_name": "安装费",
      "quantity": 1,
      "unit_price": 200000
    }
  ]
}
```

### 参数说明
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| project_id | number | 是 | 关联项目ID |
| party_a | string | 是 | 甲方名称（客户），最长100字符 |
| party_b | string | 是 | 乙方名称（本公司），最长100字符 |
| total_amount | number | 是 | 合同总金额，必须大于0 |
| sign_date | string | 否 | 签订日期，YYYY-MM-DD |
| start_date | string | 否 | 开始日期 |
| end_date | string | 否 | 结束日期 |
| payment_terms | string | 否 | 付款条款，最长500字符 |
| remark | string | 否 | 备注 |
| contract_items | array | 否 | 合同明细项 |

### contract_items结构
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| item_name | string | 是 | 项目名称 |
| quantity | number | 是 | 数量，大于0 |
| unit_price | number | 是 | 单价，大于等于0 |

### 响应
```json
{
  "success": true,
  "message": "收入合同创建成功",
  "data": {
    "id": 10,
    "contract_no": "INC-2026-010",
    "status": "draft"
  }
}
```

---

## 3.4 创建支出合同

### 请求
```
POST /api/contracts/expense
Authorization: Bearer <token>
Content-Type: application/json
```

### 权限要求
`contract:create`

### 请求体
```json
{
  "project_id": 1,
  "supplier_id": 1,
  "party_a": "甲方（本公司）名称",
  "party_b": "乙方（供应商）名称",
  "contract_category": "equipment",
  "total_amount": 500000,
  "sign_date": "2026-01-01",
  "contract_items": [
    {
      "item_name": "某某设备",
      "brand": "品牌",
      "model": "型号",
      "quantity": 1,
      "unit_price": 500000
    }
  ]
}
```

### 参数说明
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| project_id | number | 是 | 关联项目ID（必须是实体项目） |
| supplier_id | number | 否 | 供应商ID |
| party_a | string | 是 | 甲方名称（本公司） |
| party_b | string | 是 | 乙方名称（供应商） |
| contract_category | string | 是 | equipment(设备), material(材料), labor(劳务), construction(施工) |
| total_amount | number | 是 | 合同总金额 |

### 支出合同扩展字段（问题传报要求）

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| transport_method | string | 否 | 运输方式：party_a(甲方负责)、party_b(乙方负责) |
| receiver_name | string | 否 | 接货人姓名 |
| delivery_tolerance | string | 否 | 交货正负差，如 "±5%"、"±10件" |
| delivery_deadline | date | 否 | 交货期限，YYYY-MM-DD |
| payment_method | string | 否 | 货款结算方式，如 "月结30天"、"货到付款" |
| acceptor_name | string | 否 | 验收负责人姓名 |
| warranty_period | string | 否 | 质保期，如 "12个月"、"2年" |

### 完整请求体示例
```json
{
  "project_id": 1,
  "supplier_id": 1,
  "party_a": "甲方（本公司）名称",
  "party_b": "乙方（供应商）名称",
  "contract_category": "equipment",
  "total_amount": 500000,
  "sign_date": "2026-01-01",
  "transport_method": "party_b",
  "receiver_name": "张三",
  "delivery_tolerance": "±5%",
  "delivery_deadline": "2026-03-31",
  "payment_method": "月结30天",
  "acceptor_name": "李四",
  "warranty_period": "12个月",
  "contract_items": [
    {
      "item_name": "某某设备",
      "brand": "品牌",
      "model": "型号",
      "quantity": 1,
      "unit_price": 500000
    }
  ]
}
```

### 响应
```json
{
  "success": true,
  "message": "支出合同创建成功",
  "data": {
    "id": 11,
    "contract_no": "EXP-2026-011",
    "status": "draft"
  }
}
```

### 错误码
- `400`: 支出合同必须关联实体项目

---

## 3.5 获取供应商列表

### 请求
```
GET /api/contracts/suppliers
Authorization: Bearer <token>
```

### 响应
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "华为技术有限公司",
      "contact_person": "李经理",
      "phone": "13912345678",
      "email": "li@huawei.com",
      "address": "深圳市龙岗区",
      "bank_name": "工商银行",
      "bank_account": "4000123456789",
      "tax_no": "91440300123456789X",
      "status": "active"
    }
  ]
}
```

---

## 3.6 创建供应商

### 请求
```
POST /api/contracts/suppliers
Authorization: Bearer <token>
Content-Type: application/json
```

### 权限要求
`supplier:create`

### 请求体
```json
{
  "name": "供应商名称",
  "contact_person": "联系人",
  "phone": "13800138000",
  "email": "contact@supplier.com",
  "address": "地址",
  "bank_name": "银行",
  "bank_account": "账号",
  "contact_region": "负责区域",
  "tax_no": "纳税人识别号"
}
```

### 参数说明
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 供应商名称，最长100字符 |
| contact_person | string | 否 | 联系人，最长50字符 |
| phone | string | 否 | 电话，最长20字符 |
| email | string | 否 | 邮箱，最长100字符 |
| address | string | 否 | 地址，最长200字符 |
| bank_name | string | 否 | 银行名称，最长100字符 |
| bank_account | string | 否 | 银行账号，最长50字符 |
| contact_region | string | 否 | 负责区域，最长100字符 |
| tax_no | string | 否 | 税号，最长50字符 |

### 响应
```json
{
  "success": true,
  "message": "供应商创建成功",
  "data": {
    "id": 5,
    "name": "供应商名称",
    "status": "active"
  }
}
```

---

## 3.7 提交合同审批

### 请求
```
POST /api/contracts/:id/submit
Authorization: Bearer <token>
```

### 权限要求
`contract:create`

### 响应
```json
{
  "success": true,
  "message": "合同已提交审批",
  "data": {
    "approval_step": 1,
    "current_approver": "财务管理"
  }
}
```

---

## 3.8 审批通过

### 请求
```
POST /api/contracts/:id/approve
Authorization: Bearer <token>
Content-Type: application/json
```

### 请求体
```json
{
  "comment": "审批通过"
}
```

### 参数说明
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| comment | string | 否 | 审批意见，最长500字符 |

### 响应
```json
{
  "success": true,
  "message": "审批通过"
}
```

---

## 3.9 审批拒绝

### 请求
```
POST /api/contracts/:id/reject
Authorization: Bearer <token>
Content-Type: application/json
```

### 请求体
```json
{
  "comment": "拒绝原因"
}
```

### 参数说明
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| comment | string | 是 | 拒绝原因，必填 |

### 响应
```json
{
  "success": true,
  "message": "审批已拒绝"
}
```

---

# 4. 采购管理接口 (/api/purchase-lists)

## 4.1 采购清单列表

### 请求
```
GET /api/purchase-lists?project_id=1&status=draft&page=1
Authorization: Bearer <token>
```

### 查询参数
| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| project_id | number | 否 | - | 项目ID |
| status | string | 否 | - | draft, pending, approved, rejected |
| keyword | string | 否 | - | 搜索关键词 |
| page | number | 否 | 1 | 页码 |
| pageSize | number | 否 | 20 | 每页数量 |

### 响应
```json
{
  "success": true,
  "data": {
    "list": [
      {
        "id": 1,
        "list_no": "PL-2026-001",
        "name": "第一批采购清单",
        "project_id": 1,
        "project_name": "某某项目",
        "status": "approved",
        "total_amount": 50000.00,
        "item_count": 10,
        "creator_name": "张三",
        "created_at": "2026-01-01 10:00:00"
      }
    ],
    "total": 20
  }
}
```

---

## 4.2 创建采购清单

### 请求
```
POST /api/purchase-lists
Authorization: Bearer <token>
Content-Type: application/json
```

### 权限要求
`purchase:create`

### 请求体
```json
{
  "project_id": 1,
  "name": "第一批采购清单"
}
```

### 参数说明
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| project_id | number | 是 | 项目ID |
| name | string | 是 | 清单名称，最长100字符 |

### 响应
```json
{
  "success": true,
  "message": "采购清单创建成功",
  "data": {
    "id": 5,
    "list_no": "PL-2026-005",
    "status": "draft"
  }
}
```

---

## 4.3 获取采购清单详情

### 请求
```
GET /api/purchase-lists/:id
Authorization: Bearer <token>
```

### 响应
```json
{
  "success": true,
  "data": {
    "list": {
      "id": 1,
      "list_no": "PL-2026-001",
      "name": "第一批采购清单",
      "project_id": 1,
      "project_name": "某某项目",
      "status": "approved",
      "total_amount": 50000.00
    },
    "items": [
      {
        "id": 1,
        "category": "material",
        "material_name": "电缆线",
        "specification": "3*2.5mm²",
        "unit": "米",
        "quantity": 1000,
        "unit_price": 15.00,
        "total_price": 15000.00,
        "remarks": "备注"
      },
      {
        "id": 2,
        "category": "equipment",
        "material_name": "监控摄像头",
        "specification": null,
        "unit": "台",
        "quantity": 10,
        "unit_price": 2000.00,
        "total_price": 20000.00
      }
    ],
    "summary": {
      "total_items": 2,
      "total_quantity": 1010,
      "total_amount": 35000.00
    }
  }
}
```

---

## 4.4 添加采购清单项

### 请求
```
POST /api/purchase-lists/:id/items
Authorization: Bearer <token>
Content-Type: application/json
```

### 请求体
```json
{
  "category": "material",
  "material_name": "电缆线",
  "specification": "3*2.5mm²",
  "unit": "米",
  "quantity": 1000,
  "remarks": "备注"
}
```

### 参数说明
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| category | string | 是 | equipment(设备), material(材料) |
| material_name | string | 是 | 名称，最长100字符 |
| specification | string | 条件必填 | 规格型号，**材料类必填** |
| unit | string | 是 | 单位: 套, 台, 个, 支, 件, 米, kg, m², m³ |
| quantity | number | 是 | 数量，必须大于0 |
| remarks | string | 否 | 备注，最长500字符 |

### 验证规则
- category为material时，specification**必填**
- category为equipment时，specification不填（显示"-"）

### 响应
```json
{
  "success": true,
  "message": "采购清单项添加成功",
  "data": {
    "id": 15,
    "category": "material",
    "material_name": "电缆线"
  }
}
```

---

## 4.5 提交采购清单审批

### 请求
```
POST /api/purchase-lists/:id/submit
Authorization: Bearer <token>
```

### 权限要求
`purchase:create`

### 响应
```json
{
  "success": true,
  "message": "采购清单已提交审批"
}
```

### 错误码
- `400`: 只有草稿状态的清单可以提交
- `400`: 清单不能为空

---

# 5. 审批管理接口 (/api/approval)

## 5.1 待审批列表

### 请求
```
GET /api/approval/pending?page=1&pageSize=20
Authorization: Bearer <token>
```

### 响应
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
        "current_approver_name": "当前审批人",
        "amount": 50000.00
      }
    ],
    "total": 10
  }
}
```

### 审批类型说明
| approval_source | source_name | 审批流程 |
|-----------------|-------------|---------|
| project | 项目立项 | 财务 → 总经理 |
| virtual_convert | 虚拟转实体 | 财务 → 总经理 |
| purchase_list | 采购清单 | 财务 → 总经理 |
| contract | 合同审批 | 财务 → 法务 → 总经理 |
| sporadic_purchase | 零星采购 | 财务 → 总经理 |
| batch_purchase | 批量采购 | 财务 → 总经理 |
| material_payment | 材料付款 | 财务 → 总经理 |
| labor_payment | 劳务付款 | 财务 → 总经理 |
| stock_out | 出库审批 | 项目经理 → 财务 |
| overage_approval | 超量审批 | 财务 → 总经理 |

---

## 5.2 我提交的审批

### 请求
```
GET /api/approval/my-submissions?page=1
Authorization: Bearer <token>
```

### 响应
```json
{
  "success": true,
  "data": {
    "list": [...],
    "total": 5
  }
}
```

---

## 5.3 我已审批的

### 请求
```
GET /api/approval/my-approved?page=1
Authorization: Bearer <token>
```

### 响应
```json
{
  "success": true,
  "data": {
    "list": [...],
    "total": 20
  }
}
```

---

# 6. 权限代码列表

| 权限代码 | 说明 |
|---------|------|
| `project:view` | 查看项目 |
| `project:create` | 创建项目 |
| `project:edit` | 编辑项目 |
| `project:delete` | 删除项目 |
| `project:approve` | 审批项目 |
| `project:convert` | 虚拟转实体 |
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
| `user:view` | 查看用户 |
| `user:create` | 创建用户 |
| `user:edit` | 编辑用户 |
| `user:delete` | 删除用户 |
| `role:view` | 查看角色 |
| `role:create` | 创建角色 |
| `role:edit` | 编辑角色 |
| `role:delete` | 删除角色 |
| `system:manage` | 系统管理 |
| `data:export` | 导出数据 |

---

# 7. 待开发接口（问题传报需求）

> 以下接口根据2026年3月13日问题传报需求设计，待开发实现

## 7.1 合同模板管理

### 7.1.1 获取合同模板列表

```
GET /api/contract-templates?type=expense&category=equipment
Authorization: Bearer <token>
```

**查询参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 否 | income(收入), expense(支出) |
| category | string | 否 | equipment, material, labor, construction |
| status | string | 否 | active, inactive |

**响应:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "设备采购合同模板",
      "code": "EQUIPMENT_001",
      "type": "expense",
      "category": "equipment",
      "is_default": true,
      "created_at": "2026-03-21 10:00:00"
    }
  ]
}
```

---

### 7.1.2 创建合同模板

```
POST /api/contract-templates
Authorization: Bearer <token>
```

**权限要求:** `template:create`

**请求体:**
```json
{
  "name": "设备采购合同模板",
  "code": "EQUIPMENT_001",
  "type": "expense",
  "category": "equipment",
  "content": "<html>合同模板内容...</html>",
  "variables": ["party_a", "party_b", "amount", "sign_date"],
  "is_default": true
}
```

**参数说明:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 模板名称 |
| code | string | 是 | 模板代码，唯一 |
| type | string | 是 | income(收入), expense(支出) |
| category | string | 是 | equipment, material, labor, construction |
| content | string | 是 | 模板内容（HTML格式） |
| variables | array | 否 | 可变字段列表 |
| is_default | boolean | 否 | 是否默认模板 |

**响应:**
```json
{
  "success": true,
  "message": "合同模板创建成功",
  "data": {
    "id": 1,
    "code": "EQUIPMENT_001"
  }
}
```

---

### 7.1.3 根据模板生成合同

```
POST /api/contract-templates/:id/generate
Authorization: Bearer <token>
```

**请求体:**
```json
{
  "project_id": 1,
  "supplier_id": 1,
  "variables": {
    "party_a": "某某公司",
    "party_b": "供应商名称",
    "amount": 500000,
    "sign_date": "2026-03-21"
  }
}
```

**响应:**
```json
{
  "success": true,
  "message": "合同生成成功",
  "data": {
    "contract_id": 100,
    "contract_no": "EXP-2026-100"
  }
}
```

---

## 7.2 零星采购税点

### 7.2.1 创建零星采购（含税点）

```
POST /api/sporadic-purchases
Authorization: Bearer <token>
```

**请求体:**
```json
{
  "name": "零星采购申请",
  "project_id": 1,
  "contract_id": 10,
  "tax_type": "special",
  "tax_rate": 13,
  "items": [
    {
      "material_name": "螺丝",
      "specification": "M8×20",
      "unit": "个",
      "quantity": 100,
      "unit_price": 0.5,
      "tax_rate": 13
    }
  ]
}
```

**税点参数说明:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| tax_type | string | 否 | none(无), general(普票), special(专票) |
| tax_rate | number | 否 | 税率：0, 1, 3, 6, 9, 13（百分比） |

**响应:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "purchase_no": "ZL-2026-001",
    "total_amount": 50.00,
    "tax_amount": 6.50,
    "amount_with_tax": 56.50
  }
}
```

**校验规则:**
- 零星采购金额不超过收入合同金额的0.5%
- 必须关联有效的收入合同

---

## 7.3 现场签证（扩展）

### 7.3.1 创建现场签证（含关联合同和附件）

```
POST /api/changes/visa
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**请求体:**
```
project_id: 1
contract_id: 10
visa_content: 签证内容描述
reason: 签证原因
amount: 5000
remark: 备注
attachment: [文件]
```

**参数说明:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| project_id | number | 是 | 关联项目ID |
| contract_id | number | 是 | 关联合同ID（支出合同） |
| visa_content | string | 是 | 签证内容 |
| reason | string | 是 | 签证原因 |
| amount | number | 否 | 签证金额 |
| attachment | file | 否 | 附件文件（支持PDF、图片、Word） |

**审批流程:** 预算管理 → 总经理

**响应:**
```json
{
  "success": true,
  "message": "现场签证创建成功，等待审批",
  "data": {
    "id": 1,
    "visa_no": "VISA-2026-001",
    "status": "pending",
    "attachment": "/uploads/visa/VISA-2026-001.pdf"
  }
}
```

---

## 7.4 甲方需求变更（扩展附件）

### 7.4.1 创建甲方需求变更（含附件）

```
POST /api/changes/owner-changes
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**请求体:**
```
project_id: 1
change_content: 变更内容描述
reason: 变更原因
amount: 10000
remark: 备注
attachment: [文件]
```

**参数说明:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| project_id | number | 是 | 关联项目ID |
| change_content | string | 是 | 变更内容 |
| reason | string | 是 | 变更原因 |
| amount | number | 否 | 变更金额 |
| attachment | file | 否 | 附件文件 |

**审批流程:** 预算管理 → 总经理

---

## 7.5 超量采购变更（扩展附件）

### 7.5.1 创建超量采购变更（含附件）

```
POST /api/overage-approvals
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**请求体:**
```
project_id: 1
contract_id: 10
type: material
material_name: 钢材
specification: Q235B
unit: 吨
approved_quantity: 100
actual_quantity: 110
overage_quantity: 10
overage_reason: 现场签证单
attachment: [文件]
```

**参数说明:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| project_id | number | 是 | 关联项目ID |
| contract_id | number | 是 | 关联合同ID |
| type | string | 是 | material(材料), equipment(设备) |
| overage_reason | string | 是 | 超量原因：design_change(设计变更)、site_visa(现场签证单)、other(其他) |
| attachment | file | 否 | 附件文件 |

**审批流程:** 预算管理 → 总经理

---

## 7.6 附件上传通用接口

### 7.6.1 上传附件

```
POST /api/attachments/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**请求体:**
```
entity_type: visa
entity_id: 1
file: [文件]
```

**entity_type 可选值:**
- `visa` - 现场签证
- `owner_change` - 甲方需求变更
- `overage` - 超量采购变更
- `contract` - 合同附件
- `project` - 项目附件
- `bid_notice` - 中标通知书

**响应:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "file_name": "签证单.pdf",
    "file_path": "/uploads/visa/2026/03/xxx.pdf",
    "file_size": 102400,
    "file_type": "application/pdf"
  }
}
```

### 7.6.2 获取附件列表

```
GET /api/attachments?entity_type=visa&entity_id=1
Authorization: Bearer <token>
```

### 7.6.3 下载附件

```
GET /api/attachments/:id/download
Authorization: Bearer <token>
```

### 7.6.4 删除附件

```
DELETE /api/attachments/:id
Authorization: Bearer <token>
```

---

# 8. 开发优先级

根据问题传报需求，开发优先级如下：

## P0 - 高优先级（核心功能）
1. **支出合同扩展字段** - 7个字段（运输方式、接货人等）
2. **零星采购税点** - tax_type, tax_rate 字段
3. **现场签证关联合同** - contract_id 字段

## P1 - 中优先级（流程完善）
4. **附件上传通用模块** - 统一附件管理
5. **现场签证附件** - attachment 字段
6. **甲方需求变更附件** - attachment 字段
7. **超量采购变更附件** - attachment 字段

## P2 - 低优先级（增强功能）
8. **合同模板管理** - 模板表和CRUD接口
9. **根据模板生成合同** - 模板变量替换
