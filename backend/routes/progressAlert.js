/**
 * 进度偏差预警API
 */

const express = require('express');
const router = express.Router();
const { db } = require('../models/database');
const { authMiddleware } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permission');
const alertService = require('../services/progressAlertService');

/**
 * GET /api/progress-alerts
 * 获取所有项目进度偏差分析
 */
router.get('/', authMiddleware, (req, res) => {
  try {
    const analyses = alertService.analyzeAllProjects();
    
    // 按偏差排序（最严重的在前）
    analyses.sort((a, b) => a.deviation - b.deviation);

    res.json({
      success: true,
      data: analyses
    });
  } catch (error) {
    console.error('获取进度偏差分析失败:', error);
    res.status(500).json({ success: false, message: '获取失败', error: error.message });
  }
});

/**
 * GET /api/progress-alerts/project/:projectId
 * 获取单个项目的进度偏差分析
 */
router.get('/project/:projectId', authMiddleware, (req, res) => {
  try {
    const { projectId } = req.params;
    const analysis = alertService.analyzeProjectProgress(parseInt(projectId));

    if (!analysis) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('获取项目进度偏差分析失败:', error);
    res.status(500).json({ success: false, message: '获取失败', error: error.message });
  }
});

/**
 * GET /api/progress-alerts/report/:projectId
 * 生成项目进度报告
 */
router.get('/report/:projectId', authMiddleware, (req, res) => {
  try {
    const { projectId } = req.params;
    const report = alertService.generateProgressReport(parseInt(projectId));

    if (!report) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('生成进度报告失败:', error);
    res.status(500).json({ success: false, message: '生成失败', error: error.message });
  }
});

/**
 * POST /api/progress-alerts/check
 * 手动触发预警检查
 */
router.post('/check', authMiddleware, checkPermission('project:manage'), (req, res) => {
  try {
    const alerts = alertService.runDailyAlertCheck();
    
    res.json({
      success: true,
      message: `预警检查完成，发现${alerts.length}个需要关注的项目`,
      data: alerts
    });
  } catch (error) {
    console.error('执行预警检查失败:', error);
    res.status(500).json({ success: false, message: '检查失败', error: error.message });
  }
});

/**
 * GET /api/progress-alerts/history
 * 获取预警历史记录
 */
router.get('/history', authMiddleware, (req, res) => {
  try {
    const { projectId, limit = 20 } = req.query;

    let sql = `
      SELECT pa.*, p.project_no, p.name as project_name
      FROM progress_alerts pa
      JOIN projects p ON pa.project_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (projectId) {
      sql += ' AND pa.project_id = ?';
      params.push(projectId);
    }

    sql += ' ORDER BY pa.created_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const alerts = db.prepare(sql).all(...params);

    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    console.error('获取预警历史失败:', error);
    res.status(500).json({ success: false, message: '获取失败', error: error.message });
  }
});

module.exports = router;

/**
 * POST /api/progress-alerts/push
 * 手动触发进度报告推送
 */
router.post('/push', authMiddleware, checkPermission('project:manage'), (req, res) => {
  try {
    const result = alertService.runDailyProgressPush();
    
    res.json({
      success: true,
      message: `推送完成，共推送${result.total}个项目的进度报告`,
      data: result
    });
  } catch (error) {
    console.error('推送进度报告失败:', error);
    res.status(500).json({ success: false, message: '推送失败', error: error.message });
  }
});

/**
 * POST /api/progress-alerts/push/:projectId
 * 推送单个项目的进度报告
 */
router.post('/push/:projectId', authMiddleware, checkPermission('project:manage'), (req, res) => {
  try {
    const { projectId } = req.params;
    const analysis = alertService.analyzeProjectProgress(parseInt(projectId));
    
    if (!analysis) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }

    const todoIds = alertService.pushProgressReport(parseInt(projectId), analysis);
    
    res.json({
      success: true,
      message: `已推送${todoIds ? todoIds.length : 0}个待办事项`,
      data: { projectId, todoIds }
    });
  } catch (error) {
    console.error('推送进度报告失败:', error);
    res.status(500).json({ success: false, message: '推送失败', error: error.message });
  }
});

module.exports = router;
