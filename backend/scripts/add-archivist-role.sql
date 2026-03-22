-- 添加资料员角色
INSERT OR IGNORE INTO roles (code, name, description, permissions, status)
VALUES (
  'ARCHIVIST',
  '资料员',
  '资料管理权限，负责文档归档、图纸管理、库存出入库',
  '["document:view","document:create","document:edit","document:delete","drawing:view","drawing:create","drawing:edit","drawing:delete","completion:view","completion:create","completion:edit","attachment:view","attachment:upload","attachment:download","attachment:delete","inventory:view","inventory:in","inventory:out","requisition:approve","data:view","data:export"]',
  'active'
);
