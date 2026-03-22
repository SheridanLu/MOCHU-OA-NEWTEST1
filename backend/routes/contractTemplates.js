/**
 * 合同模板管理路由
 * 实现合同模板的CRUD和根据模板生成合同功能
 */

const express = require('express');
const router = express.Router();
const { db } = require('../models/database');
const authMiddleware = require('../middleware/auth').authMiddleware;
const { checkPermission } = require('../middleware/permission');

/**
 * 生成模板编号
 */
function generateTemplateCode(type, category) {
  const prefix = type === 'income' ? 'INC' : 'EXP';
  const cat = category ? category.substring(0, 3).toUpperCase() : 'GEN';
  
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM contract_templates 
    WHERE type = ? AND category = ?
  `).get(type, category);
  
  const seq = String((result?.count || 0) + 1).padStart(3, '0');
  return `${prefix}-${cat}-${seq}`;
}

/**
 * GET /api/contract-templates
 * 获取合同模板列表
 * 
 * 查询参数:
 * - type: income/expense
 * - category: equipment/material/labor/construction
 * - status: active/inactive
 * - keyword: 搜索关键词
 */
router.get('/', authMiddleware, (req, res) => {
  const { type, category, status, keyword } = req.query;
  
  let sql = `
    SELECT t.*, u.real_name as creator_name
    FROM contract_templates t
    LEFT JOIN users u ON t.creator_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (type) {
    sql += ` AND t.type = ?`;
    params.push(type);
  }

  if (category) {
    sql += ` AND t.category = ?`;
    params.push(category);
  }

  if (status) {
    sql += ` AND t.status = ?`;
    params.push(status);
  }

  if (keyword) {
    sql += ` AND (t.name LIKE ? OR t.code LIKE ? OR t.description LIKE ?)`;
    const likeKeyword = `%${keyword}%`;
    params.push(likeKeyword, likeKeyword, likeKeyword);
  }

  sql += ` ORDER BY t.is_default DESC, t.created_at DESC`;

  try {
    const templates = db.prepare(sql).all(...params);

    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('获取合同模板列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取合同模板列表失败: ' + error.message
    });
  }
});

/**
 * GET /api/contract-templates/:id
 * 获取合同模板详情
 */
router.get('/:id', authMiddleware, (req, res) => {
  const { id } = req.params;

  try {
    const template = db.prepare(`
      SELECT t.*, u.real_name as creator_name
      FROM contract_templates t
      LEFT JOIN users u ON t.creator_id = u.id
      WHERE t.id = ?
    `).get(parseInt(id));

    if (!template) {
      return res.status(404).json({
        success: false,
        message: '合同模板不存在'
      });
    }

    // 解析variables字段
    if (template.variables) {
      try {
        template.variables = JSON.parse(template.variables);
      } catch (e) {
        template.variables = [];
      }
    }

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('获取合同模板详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取合同模板详情失败: ' + error.message
    });
  }
});

/**
 * POST /api/contract-templates
 * 创建合同模板
 * 
 * 请求体:
 * - name: 模板名称
 * - code: 模板代码（可选，自动生成）
 * - type: income/expense
 * - category: equipment/material/labor/construction
 * - description: 模板描述
 * - content: 模板内容
 * - variables: 可变字段数组
 * - is_default: 是否默认模板
 */
router.post('/', authMiddleware, checkPermission('contract:create'), (req, res) => {
  const {
    name,
    code,
    type,
    category,
    description,
    content,
    variables,
    is_default
  } = req.body;

  const userId = req.user?.id;

  // 验证必填字段
  if (!name || !name.trim()) {
    return res.status(400).json({
      success: false,
      message: '模板名称不能为空'
    });
  }

  if (!type || !['income', 'expense'].includes(type)) {
    return res.status(400).json({
      success: false,
      message: '请选择有效的合同类型（income/expense）'
    });
  }

  try {
    // 生成模板代码
    const templateCode = code || generateTemplateCode(type, category);

    // 检查代码是否已存在
    const existing = db.prepare('SELECT id FROM contract_templates WHERE code = ?').get(templateCode);
    if (existing) {
      return res.status(400).json({
        success: false,
        message: '模板代码已存在'
      });
    }

    // 如果设为默认模板，取消同类型其他默认模板
    if (is_default) {
      db.prepare(`
        UPDATE contract_templates 
        SET is_default = 0 
        WHERE type = ? AND category = ?
      `).run(type, category || null);
    }

    const result = db.prepare(`
      INSERT INTO contract_templates (
        name, code, type, category, description, content, variables,
        is_default, creator_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name.trim(),
      templateCode,
      type,
      category || null,
      description || null,
      content || null,
      variables ? JSON.stringify(variables) : null,
      is_default ? 1 : 0,
      userId
    );

    const newTemplate = db.prepare('SELECT * FROM contract_templates WHERE id = ?').get(result.lastInsertRowid);

    res.json({
      success: true,
      message: '合同模板创建成功',
      data: newTemplate
    });
  } catch (error) {
    console.error('创建合同模板失败:', error);
    res.status(500).json({
      success: false,
      message: '创建合同模板失败: ' + error.message
    });
  }
});

/**
 * PUT /api/contract-templates/:id
 * 更新合同模板
 */
router.put('/:id', authMiddleware, checkPermission('contract:edit'), (req, res) => {
  const { id } = req.params;
  const {
    name,
    description,
    content,
    variables,
    is_default,
    status
  } = req.body;

  try {
    const template = db.prepare('SELECT * FROM contract_templates WHERE id = ?').get(parseInt(id));

    if (!template) {
      return res.status(404).json({
        success: false,
        message: '合同模板不存在'
      });
    }

    // 如果设为默认模板，取消同类型其他默认模板
    if (is_default) {
      db.prepare(`
        UPDATE contract_templates 
        SET is_default = 0 
        WHERE type = ? AND category = ? AND id != ?
      `).run(template.type, template.category || null, parseInt(id));
    }

    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name.trim());
    }

    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }

    if (content !== undefined) {
      updates.push('content = ?');
      params.push(content);
    }

    if (variables !== undefined) {
      updates.push('variables = ?');
      params.push(variables ? JSON.stringify(variables) : null);
    }

    if (is_default !== undefined) {
      updates.push('is_default = ?');
      params.push(is_default ? 1 : 0);
    }

    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有要更新的字段'
      });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(parseInt(id));

    db.prepare(`UPDATE contract_templates SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const updatedTemplate = db.prepare('SELECT * FROM contract_templates WHERE id = ?').get(parseInt(id));

    res.json({
      success: true,
      message: '合同模板更新成功',
      data: updatedTemplate
    });
  } catch (error) {
    console.error('更新合同模板失败:', error);
    res.status(500).json({
      success: false,
      message: '更新合同模板失败: ' + error.message
    });
  }
});

/**
 * DELETE /api/contract-templates/:id
 * 删除合同模板
 */
router.delete('/:id', authMiddleware, checkPermission('contract:delete'), (req, res) => {
  const { id } = req.params;

  try {
    const template = db.prepare('SELECT * FROM contract_templates WHERE id = ?').get(parseInt(id));

    if (!template) {
      return res.status(404).json({
        success: false,
        message: '合同模板不存在'
      });
    }

    db.prepare('DELETE FROM contract_templates WHERE id = ?').run(parseInt(id));

    res.json({
      success: true,
      message: '合同模板删除成功'
    });
  } catch (error) {
    console.error('删除合同模板失败:', error);
    res.status(500).json({
      success: false,
      message: '删除合同模板失败: ' + error.message
    });
  }
});

/**
 * POST /api/contract-templates/:id/generate
 * 根据模板生成合同预览
 * 
 * 请求体:
 * - variables: 变量值对象
 */
router.post('/:id/generate', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { variables } = req.body;

  try {
    const template = db.prepare('SELECT * FROM contract_templates WHERE id = ?').get(parseInt(id));

    if (!template) {
      return res.status(404).json({
        success: false,
        message: '合同模板不存在'
      });
    }

    if (!template.content) {
      return res.status(400).json({
        success: false,
        message: '模板内容为空'
      });
    }

    // 替换变量
    let generatedContent = template.content;
    if (variables && typeof variables === 'object') {
      Object.keys(variables).forEach(key => {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        generatedContent = generatedContent.replace(regex, variables[key] || '');
      });
    }

    // 替换未填充的变量为空字符串
    generatedContent = generatedContent.replace(/\{\{[^}]+\}\}/g, '');

    res.json({
      success: true,
      data: {
        template_id: template.id,
        template_name: template.name,
        type: template.type,
        category: template.category,
        generated_content: generatedContent
      }
    });
  } catch (error) {
    console.error('生成合同失败:', error);
    res.status(500).json({
      success: false,
      message: '生成合同失败: ' + error.message
    });
  }
});

/**
 * POST /api/contract-templates/:id/set-default
 * 设置为默认模板
 */
router.post('/:id/set-default', authMiddleware, checkPermission('contract:edit'), (req, res) => {
  const { id } = req.params;

  try {
    const template = db.prepare('SELECT * FROM contract_templates WHERE id = ?').get(parseInt(id));

    if (!template) {
      return res.status(404).json({
        success: false,
        message: '合同模板不存在'
      });
    }

    // 取消同类型其他默认模板
    db.prepare(`
      UPDATE contract_templates 
      SET is_default = 0 
      WHERE type = ? AND category = ?
    `).run(template.type, template.category || null);

    // 设置当前模板为默认
    db.prepare('UPDATE contract_templates SET is_default = 1 WHERE id = ?').run(parseInt(id));

    res.json({
      success: true,
      message: '已设置为默认模板'
    });
  } catch (error) {
    console.error('设置默认模板失败:', error);
    res.status(500).json({
      success: false,
      message: '设置默认模板失败: ' + error.message
    });
  }
});

/**
 * GET /api/contract-templates/default/:type/:category
 * 获取默认模板
 */
router.get('/default/:type/:category?', authMiddleware, (req, res) => {
  const { type, category } = req.params;

  try {
    let template;
    if (category) {
      template = db.prepare(`
        SELECT * FROM contract_templates 
        WHERE type = ? AND category = ? AND is_default = 1 AND status = 'active'
      `).get(type, category);
    } else {
      template = db.prepare(`
        SELECT * FROM contract_templates 
        WHERE type = ? AND is_default = 1 AND status = 'active'
      `).get(type);
    }

    if (!template) {
      return res.json({
        success: true,
        data: null,
        message: '未找到默认模板'
      });
    }

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('获取默认模板失败:', error);
    res.status(500).json({
      success: false,
      message: '获取默认模板失败: ' + error.message
    });
  }
});

/**
 * GET /api/contract-templates/variables/common
 * 获取常用变量列表
 */
router.get('/variables/common', authMiddleware, (req, res) => {
  res.json({
    success: true,
    data: [
      { name: 'contract_no', label: '合同编号', description: '系统自动生成的合同编号' },
      { name: 'contract_name', label: '合同名称', description: '合同标题' },
      { name: 'party_a', label: '甲方', description: '甲方（客户/本公司）' },
      { name: 'party_b', label: '乙方', description: '乙方（供应商/分包商）' },
      { name: 'amount', label: '合同金额', description: '合同总金额' },
      { name: 'amount_cn', label: '金额大写', description: '合同金额大写' },
      { name: 'sign_date', label: '签订日期', description: '合同签订日期' },
      { name: 'start_date', label: '开始日期', description: '合同开始日期' },
      { name: 'end_date', label: '结束日期', description: '合同结束日期' },
      { name: 'project_name', label: '项目名称', description: '关联项目名称' },
      { name: 'project_no', label: '项目编号', description: '关联项目编号' },
      { name: 'supplier_name', label: '供应商名称', description: '供应商名称' },
      { name: 'current_date', label: '当前日期', description: '生成日期' },
      { name: 'current_year', label: '当前年份', description: '生成年份' },
      { name: 'current_month', label: '当前月份', description: '生成月份' }
    ]
  });
});

module.exports = router;
