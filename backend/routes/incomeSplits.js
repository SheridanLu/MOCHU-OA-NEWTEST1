/**
 * 收入合同拆分路由
 * PRD 8.1: 将收入合同按任务拆分，关联甘特图，自动同步进度
 */

const express = require('express');
const router = express.Router();
const { db } = require('../models/database');
const authMiddleware = require('../middleware/auth').authMiddleware;
const { checkPermission } = require('../middleware/permission');

/**
 * GET /api/income-splits
 * 获取合同拆分列表
 * 查询参数: contract_id(必填), project_id
 */
router.get('/', authMiddleware, (req, res) => {
  try {
    const { contract_id, project_id } = req.query;

    if (!contract_id) {
      return res.status(400).json({ success: false, message: '请提供contract_id' });
    }

    let sql = `
      SELECT s.*, t.name as task_name, t.progress_rate as task_progress
      FROM income_contract_splits s
      LEFT JOIN construction_tasks t ON s.task_id = t.id
      WHERE s.contract_id = ?
      ORDER BY s.sort_order ASC, s.id ASC
    `;
    const splits = db.prepare(sql).all(parseInt(contract_id));

    // 计算汇总
    const summary = {
      total_amount: splits.reduce((sum, s) => sum + (s.split_amount || 0), 0),
      total_rate: splits.reduce((sum, s) => sum + (s.split_rate || 0), 0),
      accumulated_amount: splits.reduce((sum, s) => sum + (s.accumulated_amount || 0), 0)
    };

    res.json({ success: true, data: splits, summary });
  } catch (error) {
    console.error('获取合同拆分失败:', error);
    res.status(500).json({ success: false, message: '获取合同拆分失败' });
  }
});

/**
 * POST /api/income-splits
 * 新建合同拆分
 */
router.post('/', authMiddleware, checkPermission('project:edit'), (req, res) => {
  try {
    const { contract_id, project_id, task_name, task_id, split_amount, split_rate, sort_order, remark } = req.body;

    if (!contract_id || !project_id) {
      return res.status(400).json({ success: false, message: 'contract_id和project_id必填' });
    }
    if (!task_name) {
      return res.status(400).json({ success: false, message: '任务名称必填' });
    }

    const result = db.prepare(`
      INSERT INTO income_contract_splits (contract_id, project_id, task_name, task_id, split_amount, split_rate, sort_order, remark, creator_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      contract_id, project_id, task_name, task_id || null,
      split_amount || 0, split_rate || 0, sort_order || 0, remark || null, req.user.id
    );

    const split = db.prepare('SELECT * FROM income_contract_splits WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, data: split, message: '拆分项创建成功' });
  } catch (error) {
    console.error('创建合同拆分失败:', error);
    res.status(500).json({ success: false, message: '创建合同拆分失败' });
  }
});

/**
 * PUT /api/income-splits/:id
 * 更新合同拆分
 */
router.put('/:id', authMiddleware, checkPermission('project:edit'), (req, res) => {
  try {
    const { id } = req.params;
    const { task_name, task_id, split_amount, split_rate, sort_order, remark } = req.body;

    const existing = db.prepare('SELECT * FROM income_contract_splits WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: '拆分项不存在' });
    }

    db.prepare(`
      UPDATE income_contract_splits SET
        task_name = ?, task_id = ?, split_amount = ?, split_rate = ?,
        sort_order = ?, remark = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      task_name || existing.task_name, task_id ?? existing.task_id,
      split_amount ?? existing.split_amount, split_rate ?? existing.split_rate,
      sort_order ?? existing.sort_order, remark ?? existing.remark, id
    );

    const split = db.prepare('SELECT * FROM income_contract_splits WHERE id = ?').get(id);
    res.json({ success: true, data: split, message: '更新成功' });
  } catch (error) {
    console.error('更新合同拆分失败:', error);
    res.status(500).json({ success: false, message: '更新合同拆分失败' });
  }
});

/**
 * DELETE /api/income-splits/:id
 * 删除合同拆分
 */
router.delete('/:id', authMiddleware, checkPermission('project:edit'), (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM income_contract_splits WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: '拆分项不存在' });
    }

    db.prepare('DELETE FROM income_contract_splits WHERE id = ?').run(id);
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除合同拆分失败:', error);
    res.status(500).json({ success: false, message: '删除合同拆分失败' });
  }
});

/**
 * POST /api/income-splits/sync-progress
 * 同步甘特图进度到拆分项（自动计算当期产值和累计产值）
 */
router.post('/sync-progress', authMiddleware, checkPermission('project:edit'), (req, res) => {
  try {
    const { contract_id } = req.body;

    if (!contract_id) {
      return res.status(400).json({ success: false, message: '请提供contract_id' });
    }

    // 获取合同金额
    const contract = db.prepare('SELECT contract_amount FROM contracts WHERE id = ?').get(contract_id);
    if (!contract) {
      return res.status(404).json({ success: false, message: '合同不存在' });
    }

    const contractAmount = parseFloat(contract.contract_amount) || 0;
    const splits = db.prepare(`
      SELECT s.*, t.progress_rate as task_progress
      FROM income_contract_splits s
      LEFT JOIN construction_tasks t ON s.task_id = t.id
      WHERE s.contract_id = ?
    `).all(contract_id);

    let totalAccumulated = 0;

    splits.forEach(split => {
      const taskProgress = parseFloat(split.task_progress) || 0;
      const splitRate = parseFloat(split.split_rate) || 0;
      const splitAmount = parseFloat(split.split_amount) || 0;

      // 当期产值 = 拆分金额 × (进度% / 100)
      const currentAmount = splitRate > 0
        ? Math.round((contractAmount * splitRate / 100) * (taskProgress / 100) * 100) / 100
        : Math.round(splitAmount * (taskProgress / 100) * 100) / 100;

      totalAccumulated += currentAmount;

      db.prepare(`
        UPDATE income_contract_splits SET
          progress_rate = ?,
          current_amount = ?,
          accumulated_amount = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(taskProgress, currentAmount, currentAmount, split.id);
    });

    res.json({
      success: true,
      message: '进度同步成功',
      data: { total_accumulated: totalAccumulated, contract_amount: contractAmount }
    });
  } catch (error) {
    console.error('同步进度失败:', error);
    res.status(500).json({ success: false, message: '同步进度失败' });
  }
});

module.exports = router;
