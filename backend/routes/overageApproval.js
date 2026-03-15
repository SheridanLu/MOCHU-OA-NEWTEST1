const express = require('express');
const router = express.Router();
const { db } = require('../models/database');
const { authMiddleware } = require('../middleware/auth');

// 生成审批编号
function generateApprovalNo(projectId) {
  const project = db.prepare('SELECT project_no FROM projects WHERE id = ?').get(projectId);
  if (!project) throw new Error('项目不存在');
  
  const count = db.prepare('SELECT COUNT(*) as total FROM overage_approvals WHERE project_id = ?').get(projectId);
  const seq = String((count?.total || 0) + 1).padStart(2, '0');
  return `${project.project_no}-OA${seq}`;
}

// 获取超量审批列表
router.get('/', authMiddleware, (req, res) => {
  try {
    const { project_id, approval_type, status, page = 1, pageSize = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    
    let sql = `
      SELECT oa.*, 
             u.real_name as applicant_name
      FROM overage_approvals oa
      LEFT JOIN users u ON oa.applicant_id = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (project_id) {
      sql += ' AND oa.project_id = ?';
      params.push(project_id);
    }
    
    if (approval_type) {
      sql += ' AND oa.approval_type = ?';
      params.push(approval_type);
    }
    
    if (status) {
      sql += ' AND oa.status = ?';
      params.push(status);
    }
    
    const countSql = sql.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM');
    const countResult = db.prepare(countSql).get(...params);
    const total = countResult?.total || 0;
    
    sql += ' ORDER BY oa.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), offset);
    
    const list = db.prepare(sql).all(...params);
    
    res.json({ success: true, data: list, pagination: { page: parseInt(page), pageSize: parseInt(pageSize), total } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 创建超量审批
router.post('/', authMiddleware, (req, res) => {
  try {
    const {
      approval_type, contract_id, contract_no, contract_name,
      project_id, project_name, supplier_id, supplier_name,
      material_name, specification, equipment_params, unit, quantity,
      reason, reason_remark
    } = req.body;
    const userId = req.user.id;
    
    if (!approval_type || !project_id) {
      return res.status(400).json({ success: false, message: '缺少必填字段' });
    }
    
    const approval_no = generateApprovalNo(project_id);
    
    const result = db.prepare(`
      INSERT INTO overage_approvals (
        approval_no, approval_type, contract_id, contract_no, contract_name,
        project_id, project_name, supplier_id, supplier_name,
        material_name, specification, equipment_params, unit, quantity,
        reason, reason_remark, status, applicant_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, datetime('now'), datetime('now'))
    `).run(
      approval_no, approval_type, contract_id || null, contract_no || '', contract_name || '',
      project_id, project_name || '', supplier_id || null, supplier_name || '',
      material_name || '', specification || '', equipment_params || '', unit || '', quantity || 0,
      reason || 'other', reason_remark || '', userId
    );
    
    // 创建审批流程
    const approvalId = result.lastInsertRowid;
    const steps = [
      { step: 1, role: 'BUDGET' },
      { step: 2, role: 'GM' }
    ];
    
    const insertStep = db.prepare(`
      INSERT INTO overage_approval_steps (overage_approval_id, step, role, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `);
    
    for (const step of steps) {
      insertStep.run(approvalId, step.step, step.role);
    }
    
    res.json({ success: true, message: '创建成功', data: { id: approvalId, approval_no } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取详情
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    
    const approval = db.prepare(`
      SELECT oa.*, u.real_name as applicant_name
      FROM overage_approvals oa
      LEFT JOIN users u ON oa.applicant_id = u.id
      WHERE oa.id = ?
    `).get(id);
    
    if (!approval) {
      return res.status(404).json({ success: false, message: '不存在' });
    }
    
    const steps = db.prepare(`
      SELECT oas.*, u.real_name as approver_name
      FROM overage_approval_steps oas
      LEFT JOIN users u ON oas.approver_id = u.id
      WHERE oas.overage_approval_id = ?
      ORDER BY oas.step
    `).all(id);
    
    res.json({ success: true, data: { ...approval, steps } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 审批
router.post('/:id/approve', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { step, action, opinion } = req.body;
    const userId = req.user.id;
    
    const approval = db.prepare('SELECT * FROM overage_approvals WHERE id = ?').get(id);
    if (!approval) {
      return res.status(404).json({ success: false, message: '不存在' });
    }
    
    if (approval.status !== 'pending') {
      return res.status(400).json({ success: false, message: '已审批' });
    }
    
    const currentStep = db.prepare(`
      SELECT * FROM overage_approval_steps 
      WHERE overage_approval_id = ? AND step = ? AND action IS NULL
    `).get(id, step);
    
    if (!currentStep) {
      return res.status(400).json({ success: false, message: '该步骤已审批' });
    }
    
    // 更新审批步骤
    db.prepare(`
      UPDATE overage_approval_steps 
      SET approver_id = ?, action = ?, opinion = ?, approved_at = datetime('now')
      WHERE id = ?
    `).run(userId, action, opinion || '', currentStep.id);
    
    if (action === 'reject') {
      db.prepare("UPDATE overage_approvals SET status = 'rejected', updated_at = datetime('now') WHERE id = ?").run(id);
    } else {
      const nextStep = db.prepare(`
        SELECT * FROM overage_approval_steps 
        WHERE overage_approval_id = ? AND step > ? AND action IS NULL
        ORDER BY step LIMIT 1
      `).get(id, step);
      
      if (!nextStep) {
        db.prepare("UPDATE overage_approvals SET status = 'approved', updated_at = datetime('now') WHERE id = ?").run(id);
      }
    }
    
    res.json({ success: true, message: action === 'approve' ? '审批通过' : '已拒绝' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
