const express = require('express');
const router = express.Router();
const { db } = require('../models/database');
const { authMiddleware } = require('../middleware/auth');
const { checkPermission, attachPermissions } = require('../middleware/permission');

// 为所有路由附加认证和权限信息
router.use(authMiddleware, attachPermissions);

/**
 * GET /api/receipts
 * 获取项目收款登记列表
 */
router.get('/', checkPermission('receipt:view'), (req, res) => {
  try {
    const { 
      project_id, 
      status, 
      start_date, 
      end_date, 
      keyword,
      page = 1, 
      pageSize = 10 
    } = req.query;
    
    let sql = `
      SELECT pr.*, 
        p.project_no, p.name as project_name,
        u.real_name as creator_name
      FROM project_receipts pr
      LEFT JOIN projects p ON pr.project_id = p.id
      LEFT JOIN users u ON pr.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (project_id) {
      sql += ' AND pr.project_id = ?';
      params.push(project_id);
    }
    
    if (status) {
      sql += ' AND pr.status = ?';
      params.push(status);
    }
    
    if (start_date) {
      sql += ' AND pr.receipt_date >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      sql += ' AND pr.receipt_date <= ?';
      params.push(end_date);
    }
    
    if (keyword) {
      sql += ' AND (p.project_no LIKE ? OR p.name LIKE ? OR pr.invoice_number LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    
    // 获取总数
    const countSql = `SELECT COUNT(*) as total FROM project_receipts pr
      LEFT JOIN projects p ON pr.project_id = p.id
      LEFT JOIN users u ON pr.created_by = u.id
      WHERE 1=1${project_id ? ' AND pr.project_id = ?' : ''}${status ? ' AND pr.status = ?' : ''}${start_date ? ' AND pr.receipt_date >= ?' : ''}${end_date ? ' AND pr.receipt_date <= ?' : ''}${keyword ? " AND (p.project_no LIKE ? OR p.name LIKE ? OR pr.invoice_number LIKE ?)" : ''}`;
    const countParams = params.slice();
    const totalResult = db.prepare(countSql).get(...countParams);
    const total = totalResult.total;
    
    // 分页
    sql += ' ORDER BY pr.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));
    
    const receipts = db.prepare(sql).all(...params);
    
    res.json({
      success: true,
      data: receipts,
      pagination: {
        current: parseInt(page),
        pageSize: parseInt(pageSize),
        total
      }
    });
  } catch (error) {
    console.error('获取收款登记列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取收款登记列表失败'
    });
  }
});

/**
 * POST /api/receipts
 * 创建收款登记
 */
router.post('/', checkPermission('receipt:create'), (req, res) => {
  try {
    const {
      project_id,
      invoice_number,
      invoice_amount,
      receipt_amount,
      receipt_date,
      payment_method,
      payer_name,
      bank_account,
      remarks
    } = req.body;
    
    if (!project_id) {
      return res.status(400).json({ success: false, message: '请选择项目' });
    }
    
    if (!receipt_amount || receipt_amount <= 0) {
      return res.status(400).json({ success: false, message: '收款金额必须大于0' });
    }
    
    if (!receipt_date) {
      return res.status(400).json({ success: false, message: '请选择收款日期' });
    }
    
    const userId = req.user.id;
    
    // 生成收款编号（使用项目编号作为前缀）
    const project = db.prepare('SELECT project_no FROM projects WHERE id = ?').get(project_id);
    if (!project) {
      return res.status(400).json({ success: false, message: '项目不存在' });
    }
    
    // 获取该项目已有收款数量
    const count = db.prepare(`
      SELECT COUNT(*) as total FROM project_receipts WHERE project_id = ?
    `).get(project_id);
    
    const seq = String((count?.total || 0) + 1).padStart(2, '0');
    const receiptNo = `${project.project_no}-SK${seq}`;
    
    const result = db.prepare(`
      INSERT INTO project_receipts (
        receipt_no, project_id, invoice_number, invoice_amount, receipt_amount,
        receipt_date, payment_method, payer_name, bank_account,
        remarks, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?)
    `).run(
      receiptNo, project_id, invoice_number, invoice_amount || 0, receipt_amount,
      receipt_date, payment_method, payer_name, bank_account, remarks, userId
    );
    
    const newReceipt = db.prepare(`
      SELECT pr.*, 
        p.project_no, p.name as project_name,
        u.real_name as creator_name
      FROM project_receipts pr
      LEFT JOIN projects p ON pr.project_id = p.id
      LEFT JOIN users u ON pr.created_by = u.id
      WHERE pr.id = ?
    `).get(result.lastInsertRowid);
    
    res.json({
      success: true,
      message: '收款登记创建成功',
      data: newReceipt
    });
  } catch (error) {
    console.error('创建收款登记失败:', error);
    res.status(500).json({ success: false, message: '创建收款登记失败' });
  }
});

/**
 * PUT /api/receipts/:id
 * 更新收款登记
 */
router.put('/:id', checkPermission('receipt:edit'), (req, res) => {
  try {
    const { id } = req.params;
    const {
      project_id, invoice_number, invoice_amount, receipt_amount,
      receipt_date, payment_method, payer_name, bank_account, remarks, status
    } = req.body;
    
    const existing = db.prepare('SELECT * FROM project_receipts WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: '收款登记不存在' });
    }
    
    db.prepare(`
      UPDATE project_receipts SET
        project_id = COALESCE(?, project_id),
        invoice_number = COALESCE(?, invoice_number),
        invoice_amount = COALESCE(?, invoice_amount),
        receipt_amount = COALESCE(?, receipt_amount),
        receipt_date = COALESCE(?, receipt_date),
        payment_method = COALESCE(?, payment_method),
        payer_name = COALESCE(?, payer_name),
        bank_account = COALESCE(?, bank_account),
        remarks = COALESCE(?, remarks),
        status = COALESCE(?, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      project_id, invoice_number, invoice_amount, receipt_amount,
      receipt_date, payment_method, payer_name, bank_account, remarks, status, id
    );
    
    const updatedReceipt = db.prepare(`
      SELECT pr.*, 
        p.project_no, p.name as project_name,
        u.real_name as creator_name
      FROM project_receipts pr
      LEFT JOIN projects p ON pr.project_id = p.id
      LEFT JOIN users u ON pr.created_by = u.id
      WHERE pr.id = ?
    `).get(id);
    
    res.json({ success: true, message: '收款登记更新成功', data: updatedReceipt });
  } catch (error) {
    console.error('更新收款登记失败:', error);
    res.status(500).json({ success: false, message: '更新收款登记失败' });
  }
});

/**
 * DELETE /api/receipts/:id
 * 删除收款登记
 */
router.delete('/:id', checkPermission('receipt:delete'), (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = db.prepare('SELECT * FROM project_receipts WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: '收款登记不存在' });
    }
    
    db.prepare('DELETE FROM project_receipts WHERE id = ?').run(id);
    res.json({ success: true, message: '收款登记删除成功' });
  } catch (error) {
    console.error('删除收款登记失败:', error);
    res.status(500).json({ success: false, message: '删除收款登记失败' });
  }
});

module.exports = router;
