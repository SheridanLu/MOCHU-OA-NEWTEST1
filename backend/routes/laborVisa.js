const express = require('express');
const router = express.Router();
const { db } = require('../models/database');
const { authMiddleware } = require('../middleware/auth');

/**
 * 审批流程配置
 * 顺序：预算管理 -> 总经理
 */
function getApprovalSteps() {
  return [
    { step: 1, role: 'BUDGET', roleName: '预算管理' },
    { step: 2, role: 'GM', roleName: '总经理' }
  ];
}

/**
 * 生成签证编号
 */
function generateVisaNo(projectId) {
  const project = db.prepare('SELECT project_no FROM projects WHERE id = ?').get(projectId);
  if (!project) throw new Error('项目不存在');
  
  const count = db.prepare('SELECT COUNT(*) as total FROM labor_visas WHERE project_id = ?').get(projectId);
  const seq = String((count?.total || 0) + 1).padStart(2, '0');
  return `${project.project_no}-V${seq}`;
}

/**
 * GET /api/labor-visas
 * 获取劳务签证列表
 */
router.get('/', authMiddleware, (req, res) => {
  try {
    const { projectId, status } = req.query;
    
    let sql = `
      SELECT lv.*, 
             p.project_no, p.name as project_name,
             c.contract_no, c.name as contract_name,
             u.real_name as applicant_name
      FROM labor_visas lv
      LEFT JOIN projects p ON lv.project_id = p.id
      LEFT JOIN contracts c ON lv.contract_id = c.id
      LEFT JOIN users u ON lv.applicant_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (projectId) {
      sql += ' AND lv.project_id = ?';
      params.push(projectId);
    }

    if (status) {
      sql += ' AND lv.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY lv.created_at DESC';

    const list = db.prepare(sql).all(...params);

    res.json({ success: true, data: list });
  } catch (error) {
    console.error('获取劳务签证列表失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/labor-visas/:id
 * 获取劳务签证详情（含审批记录）
 */
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;

    const visa = db.prepare(`
      SELECT lv.*, 
             p.project_no, p.name as project_name,
             c.contract_no, c.name as contract_name,
             u.real_name as applicant_name
      FROM labor_visas lv
      LEFT JOIN projects p ON lv.project_id = p.id
      LEFT JOIN contracts c ON lv.contract_id = c.id
      LEFT JOIN users u ON lv.applicant_id = u.id
      WHERE lv.id = ?
    `).get(id);

    if (!visa) {
      return res.status(404).json({ success: false, message: '签证不存在' });
    }

    // 获取审批记录
    const approvals = db.prepare(`
      SELECT lva.*, u.real_name as approver_name
      FROM labor_visa_approvals lva
      LEFT JOIN users u ON lva.approver_id = u.id
      WHERE lva.visa_id = ?
      ORDER BY lva.step
    `).all(id);

    res.json({
      success: true,
      data: { ...visa, approvals, approvalSteps: getApprovalSteps() }
    });
  } catch (error) {
    console.error('获取签证详情失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/labor-visas
 * 创建劳务签证申请（含初始化审批流程）
 */
router.post('/', authMiddleware, (req, res) => {
  try {
    const { projectId, contractId, visaType, title, description, amount, reason, attachments } = req.body;
    const userId = req.user.id;

    if (!projectId || !visaType || !title) {
      return res.status(400).json({ success: false, message: '缺少必填字段' });
    }

    const visaNo = generateVisaNo(projectId);
    const steps = getApprovalSteps();

    // 使用事务
    const createVisa = db.transaction(() => {
      // 创建签证
      const result = db.prepare(`
        INSERT INTO labor_visas (
          visa_no, project_id, contract_id, visa_type, title,
          description, amount, reason, attachments, status,
          applicant_id, applied_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, datetime('now'), datetime('now'), datetime('now'))
      `).run(
        visaNo, projectId, contractId || null, visaType, title,
        description || '', amount || 0, reason || '', attachments || null, userId
      );

      const visaId = result.lastInsertRowid;

      // 创建审批流程记录
      const insertApproval = db.prepare(`
        INSERT INTO labor_visa_approvals (visa_id, step, role, action, created_at)
        VALUES (?, ?, ?, 'pending', datetime('now'))
      `);

      for (const step of steps) {
        insertApproval.run(visaId, step.step, step.role);
      }

      return visaId;
    });

    const visaId = createVisa();

    res.json({
      success: true,
      message: '劳务签证申请提交成功',
      data: { id: visaId, visaNo }
    });
  } catch (error) {
    console.error('创建劳务签证失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/labor-visas/:id
 * 更新劳务签证（仅待审批状态可修改）
 */
router.put('/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { contractId, visaType, title, description, amount, reason, attachments } = req.body;

    const visa = db.prepare('SELECT * FROM labor_visas WHERE id = ?').get(id);
    if (!visa) {
      return res.status(404).json({ success: false, message: '签证不存在' });
    }

    if (visa.status !== 'pending') {
      return res.status(400).json({ success: false, message: '仅待审批状态可修改' });
    }

    db.prepare(`
      UPDATE labor_visas 
      SET contract_id = ?, visa_type = ?, title = ?, description = ?,
          amount = ?, reason = ?, attachments = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      contractId || null, visaType, title, description, amount, reason, attachments, id
    );

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新劳务签证失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/labor-visas/:id/approve
 * 审批劳务签证
 */
router.post('/:id/approve', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { step, action, opinion } = req.body;
    const userId = req.user.id;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: '无效的审批动作' });
    }

    const visa = db.prepare('SELECT * FROM labor_visas WHERE id = ?').get(id);
    if (!visa) {
      return res.status(404).json({ success: false, message: '签证不存在' });
    }

    if (visa.status !== 'pending') {
      return res.status(400).json({ success: false, message: '该签证已审批完成' });
    }

    // 获取当前审批步骤
    const currentApproval = db.prepare(`
      SELECT * FROM labor_visa_approvals 
      WHERE visa_id = ? AND step = ? AND action = 'pending'
    `).get(id, step);

    if (!currentApproval) {
      return res.status(400).json({ success: false, message: '该步骤已审批或不存在' });
    }

    // 使用事务
    const processApproval = db.transaction(() => {
      // 更新审批记录
      db.prepare(`
        UPDATE labor_visa_approvals 
        SET approver_id = ?, action = ?, opinion = ?, approved_at = datetime('now')
        WHERE id = ?
      `).run(userId, action, opinion || '', currentApproval.id);

      // 如果拒绝，更新签证状态为拒绝
      if (action === 'reject') {
        db.prepare("UPDATE labor_visas SET status = 'rejected', updated_at = datetime('now') WHERE id = ?").run(id);
      } else {
        // 检查是否还有下一步审批
        const nextStep = db.prepare(`
          SELECT * FROM labor_visa_approvals 
          WHERE visa_id = ? AND step > ? AND action = 'pending'
          ORDER BY step LIMIT 1
        `).get(id, step);

        if (!nextStep) {
          // 没有下一步，审批通过
          db.prepare("UPDATE labor_visas SET status = 'approved', updated_at = datetime('now') WHERE id = ?").run(id);
        }
      }
    });

    processApproval();

    res.json({
      success: true,
      message: action === 'approve' ? '审批通过' : '已拒绝'
    });
  } catch (error) {
    console.error('审批失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /api/labor-visas/:id
 * 删除劳务签证（仅待审批状态可删除）
 */
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;

    const visa = db.prepare('SELECT * FROM labor_visas WHERE id = ?').get(id);
    if (!visa) {
      return res.status(404).json({ success: false, message: '签证不存在' });
    }

    if (visa.status !== 'pending') {
      return res.status(400).json({ success: false, message: '仅待审批状态可删除' });
    }

    // 删除审批记录
    db.prepare('DELETE FROM labor_visa_approvals WHERE visa_id = ?').run(id);
    // 删除签证
    db.prepare('DELETE FROM labor_visas WHERE id = ?').run(id);

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/labor-visas/pending/my
 * 获取待我审批的劳务签证
 */
router.get('/pending/my', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;

    // 获取用户角色
    const userRoles = db.prepare(`
      SELECT r.code FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = ?
    `).all(userId);

    const roleCodes = userRoles.map(r => r.code);
    if (roleCodes.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // 获取待审批的签证
    const placeholders = roleCodes.map(() => '?').join(',');
    const visas = db.prepare(`
      SELECT lv.*, lva.step,
             p.project_no, p.name as project_name,
             u.real_name as applicant_name
      FROM labor_visas lv
      JOIN labor_visa_approvals lva ON lv.id = lva.visa_id
      LEFT JOIN projects p ON lv.project_id = p.id
      LEFT JOIN users u ON lv.applicant_id = u.id
      WHERE lv.status = 'pending' 
        AND lva.action = 'pending'
        AND lva.role IN (${placeholders})
      ORDER BY lv.applied_at DESC
    `).all(...roleCodes);

    res.json({ success: true, data: visas });
  } catch (error) {
    console.error('获取待审批列表失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
