/**
 * 进度偏差预警服务
 * 功能：
 * 1. 对照里程碑计划进度与实际进度
 * 2. 计算进度偏差
 * 3. 生成改进建议
 * 4. 形成进度报告
 */

const { db } = require('../models/database');

/**
 * 获取所有进行中项目的进度偏差分析
 */
function analyzeAllProjects() {
  const projects = db.prepare(`
    SELECT id, project_no, name, contract_amount, start_date, end_date, status,
           manager_id
    FROM projects 
    WHERE type = 'entity' AND status IN ('pending', 'active', 'in_progress')
  `).all();

  const results = [];
  
  for (const project of projects) {
    const analysis = analyzeProjectProgress(project.id);
    if (analysis) {
      results.push({
        ...project,
        ...analysis
      });
    }
  }

  return results;
}

/**
 * 分析单个项目的进度偏差
 */
function analyzeProjectProgress(projectId) {
  // 获取项目信息
  const project = db.prepare(`
    SELECT id, project_no, name, contract_amount, start_date, end_date, manager_id
    FROM projects WHERE id = ?
  `).get(projectId);

  if (!project) return null;

  // 获取最新施工进度
  const latestProgress = db.prepare(`
    SELECT progress_rate, report_date, work_content, issues
    FROM construction_progress 
    WHERE project_id = ? AND status IN ('submitted', 'approved')
    ORDER BY report_date DESC LIMIT 1
  `).get(projectId);

  if (!latestProgress) {
    return {
      actualProgress: 0,
      plannedProgress: calculatePlannedProgress(project.start_date, project.end_date),
      deviation: 0,
      status: 'no_data',
      suggestion: '该项目尚未进行进度填报，请及时填报施工进度。'
    };
  }

  // 计算计划进度（基于时间）
  const plannedProgress = calculatePlannedProgress(project.start_date, project.end_date);
  const actualProgress = parseFloat(latestProgress.progress_rate) || 0;
  const deviation = actualProgress - plannedProgress;

  // 获取里程碑完成情况
  const milestoneStatus = getMilestoneStatus(projectId);

  // 生成状态和建议
  const { status, suggestion } = generateSuggestion(deviation, milestoneStatus, latestProgress);

  return {
    actualProgress,
    plannedProgress,
    deviation: Math.round(deviation * 100) / 100,
    status,
    suggestion,
    latestReportDate: latestProgress.report_date,
    issues: latestProgress.issues,
    milestoneStatus,
    managerId: project.manager_id
  };
}

/**
 * 计算计划进度（基于时间进度）
 */
function calculatePlannedProgress(startDate, endDate) {
  if (!startDate || !endDate) return 0;

  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();

  // 如果还没开始
  if (now < start) return 0;
  
  // 如果已结束
  if (now > end) return 100;

  const totalDays = (end - start) / (1000 * 60 * 60 * 24);
  const passedDays = (now - start) / (1000 * 60 * 60 * 24);

  return Math.round((passedDays / totalDays) * 100 * 100) / 100;
}

/**
 * 获取里程碑完成状态
 */
function getMilestoneStatus(projectId) {
  const milestones = db.prepare(`
    SELECT id, name, planned_date, actual_date, status, progress_rate
    FROM construction_milestones 
    WHERE project_id = ?
    ORDER BY planned_date
  `).all(projectId);

  if (milestones.length === 0) {
    return { total: 0, completed: 0, delayed: 0, onTrack: 0 };
  }

  const now = new Date();
  let completed = 0;
  let delayed = 0;
  let onTrack = 0;

  milestones.forEach(m => {
    if (m.status === 'completed') {
      completed++;
      // 检查是否延期完成
      if (m.actual_date && new Date(m.actual_date) > new Date(m.planned_date)) {
        delayed++;
      }
    } else if (new Date(m.planned_date) < now && m.status !== 'completed') {
      delayed++;
    } else {
      onTrack++;
    }
  });

  return {
    total: milestones.length,
    completed,
    delayed,
    onTrack,
    details: milestones
  };
}

/**
 * 生成改进建议
 */
function generateSuggestion(deviation, milestoneStatus, latestProgress) {
  let status, suggestion;

  if (deviation >= 10) {
    status = 'ahead';
    suggestion = '项目进度超前，可考虑优化资源配置或提前进行下阶段工作。';
  } else if (deviation >= -5) {
    status = 'on_track';
    suggestion = '项目进度正常，继续保持当前施工节奏。';
  } else if (deviation >= -15) {
    status = 'slight_delay';
    suggestion = '项目进度略有滞后，建议分析原因并采取以下措施：\n';
    if (latestProgress.issues) {
      suggestion += `1. 当前问题：${latestProgress.issues}\n`;
    }
    suggestion += '- 优化施工组织，提高效率\n';
    suggestion += '- 考虑增加人力或设备投入\n';
    suggestion += '- 检查材料供应是否及时';
  } else {
    status = 'serious_delay';
    suggestion = '⚠️ 项目进度严重滞后！建议立即采取以下措施：\n';
    suggestion += '- 召开项目进度专题会议\n';
    suggestion += '- 分析滞后原因，制定追赶计划\n';
    suggestion += '- 必要时调整项目计划\n';
    if (milestoneStatus.delayed > 0) {
      suggestion += `- 有${milestoneStatus.delayed}个里程碑已延期，重点关注\n`;
    }
    suggestion += '- 向管理层汇报并寻求支持';
  }

  return { status, suggestion };
}

/**
 * 生成进度报告
 */
function generateProgressReport(projectId) {
  const analysis = analyzeProjectProgress(projectId);
  if (!analysis) return null;

  const project = db.prepare(`
    SELECT p.*, u.real_name as manager_name
    FROM projects p
    LEFT JOIN users u ON p.manager_id = u.id
    WHERE p.id = ?
  `).get(projectId);

  const report = {
    reportNo: `RPT${Date.now()}`,
    generateTime: new Date().toISOString(),
    project: {
      id: project.id,
      projectNo: project.project_no,
      name: project.name,
      manager: project.manager_name,
      contractAmount: project.contract_amount,
      startDate: project.start_date,
      endDate: project.end_date
    },
    progress: {
      actual: analysis.actualProgress,
      planned: analysis.plannedProgress,
      deviation: analysis.deviation
    },
    status: analysis.status,
    suggestion: analysis.suggestion,
    issues: analysis.issues,
    milestoneStatus: analysis.milestoneStatus
  };

  return report;
}

/**
 * 获取需要推送的用户列表
 * @param {number} projectId 项目ID
 * @returns {Array} 用户ID列表
 */
function getNotifyUsers(projectId) {
  const project = db.prepare('SELECT manager_id FROM projects WHERE id = ?').get(projectId);
  
  // 获取需要通知的角色用户
  const roleUsers = db.prepare(`
    SELECT DISTINCT u.id
    FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    WHERE r.code IN ('PROJECT_MANAGER', 'PURCHASE', 'FINANCE', 'BUDGET', 'GM')
    AND u.status = 'active'
  `).all();

  const userIds = roleUsers.map(u => u.id);
  
  // 添加项目经理
  if (project && project.manager_id && !userIds.includes(project.manager_id)) {
    userIds.push(project.manager_id);
  }

  return userIds;
}

/**
 * 保存偏差预警记录
 */
function saveAlertRecord(projectId, analysis) {
  try {
    const result = db.prepare(`
      INSERT INTO progress_alerts (
        project_id, actual_progress, planned_progress, deviation,
        status, suggestion, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      projectId,
      analysis.actualProgress,
      analysis.plannedProgress,
      analysis.deviation,
      analysis.status,
      analysis.suggestion
    );
    return result.lastInsertRowid;
  } catch (e) {
    // 表可能不存在，创建表
    createAlertsTable();
    return saveAlertRecord(projectId, analysis);
  }
}

/**
 * 创建预警表
 */
function createAlertsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS progress_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      actual_progress DECIMAL(5,2),
      planned_progress DECIMAL(5,2),
      deviation DECIMAL(5,2),
      status VARCHAR(20),
      suggestion TEXT,
      is_notified INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    )
  `);
}

/**
 * 执行每日预警检查
 */
function runDailyAlertCheck() {
  console.log('开始执行进度偏差预警检查...');
  
  const analyses = analyzeAllProjects();
  const alerts = [];

  for (const analysis of analyses) {
    // 只对有偏差的项目生成预警
    if (analysis.deviation < -5) {
      const alertId = saveAlertRecord(analysis.id, analysis);
      
      alerts.push({
        alertId,
        projectId: analysis.id,
        projectNo: analysis.project_no,
        projectName: analysis.name,
        deviation: analysis.deviation,
        status: analysis.status,
        suggestion: analysis.suggestion
      });
    }
  }

  console.log(`预警检查完成，发现${alerts.length}个需要关注的项目`);
  return alerts;
}

module.exports = {
  analyzeAllProjects,
  analyzeProjectProgress,
  generateProgressReport,
  getNotifyUsers,
  saveAlertRecord,
  runDailyAlertCheck,
  calculatePlannedProgress,
  generateSuggestion
};

/**
 * 推送进度报告待办事项给相关人员
 * @param {number} projectId 项目ID
 * @param {object} analysis 进度分析结果
 */
function pushProgressReport(projectId, analysis) {
  const { createTodo } = require('../routes/todo');
  
  // 获取项目信息
  const project = db.prepare(`
    SELECT p.*, u.real_name as manager_name
    FROM projects p
    LEFT JOIN users u ON p.manager_id = u.id
    WHERE p.id = ?
  `).get(projectId);

  if (!project) return;

  // 获取需要通知的角色用户
  const notifyRoles = ['PROJECT_MANAGER', 'PURCHASE', 'FINANCE', 'BUDGET', 'GM'];
  
  const users = db.prepare(`
    SELECT DISTINCT u.id, u.real_name, r.code as role_code
    FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    WHERE r.code IN (${notifyRoles.map(() => '?').join(',')})
    AND u.status = 'active'
  `).all(...notifyRoles);

  // 确定优先级
  let priority = 'normal';
  if (analysis.status === 'serious_delay') {
    priority = 'urgent';
  } else if (analysis.status === 'slight_delay') {
    priority = 'high';
  }

  // 构建待办标题和内容
  const statusText = {
    'ahead': '进度超前',
    'on_track': '进度正常',
    'slight_delay': '轻微滞后',
    'serious_delay': '严重滞后',
    'no_data': '无进度数据'
  };

  const title = `【进度报告】${project.project_no} - ${project.name}`;
  const content = `
项目进度偏差预警报告

项目名称: ${project.name}
项目编号: ${project.project_no}
项目经理: ${project.manager_name || '未指定'}

计划进度: ${analysis.plannedProgress}%
实际进度: ${analysis.actualProgress}%
偏差: ${analysis.deviation > 0 ? '+' : ''}${analysis.deviation}%
状态: ${statusText[analysis.status] || analysis.status}

改进建议:
${analysis.suggestion}

${analysis.issues ? '当前问题:\n' + analysis.issues : ''}
  `.trim();

  // 为每个相关用户创建待办
  const todoIds = [];
  for (const user of users) {
    const todoId = createTodo({
      title,
      content,
      type: 'progress_alert',
      priority,
      projectId,
      relatedId: projectId,
      relatedType: 'progress_report',
      assigneeId: user.id,
      assignerId: 1, // 系统创建
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 3天后
    });
    if (todoId) {
      todoIds.push({ userId: user.id, todoId, role: user.role_code });
    }
  }

  // 同时给项目经理创建待办
  if (project.manager_id && !users.find(u => u.id === project.manager_id)) {
    const todoId = createTodo({
      title,
      content,
      type: 'progress_alert',
      priority,
      projectId,
      relatedId: projectId,
      relatedType: 'progress_report',
      assigneeId: project.manager_id,
      assignerId: 1,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    });
    if (todoId) {
      todoIds.push({ userId: project.manager_id, todoId, role: 'PROJECT_MANAGER' });
    }
  }

  return todoIds;
}

/**
 * 执行每日进度预警推送
 */
function runDailyProgressPush() {
  console.log('开始执行进度预警推送...');
  
  const analyses = analyzeAllProjects();
  const pushedCount = { total: 0, urgent: 0, high: 0 };

  for (const analysis of analyses) {
    // 只对有偏差的项目推送（滞后或超前超过10%）
    if (Math.abs(analysis.deviation) > 5) {
      const todoIds = pushProgressReport(analysis.id, analysis);
      if (todoIds && todoIds.length > 0) {
        pushedCount.total++;
        if (analysis.status === 'serious_delay') {
          pushedCount.urgent++;
        } else if (analysis.status === 'slight_delay') {
          pushedCount.high++;
        }

        // 同时发送站内通知
        try {
          const statusText = {
            'ahead': '进度超前',
            'on_track': '进度正常',
            'slight_delay': '轻微滞后',
            'serious_delay': '严重滞后',
            'no_data': '无进度数据'
          };
          const notifTitle = `【偏差预警】${analysis.project_no || ''} ${analysis.deviation > 0 ? '+' : ''}${analysis.deviation}%`;
          const notifContent = `项目: ${analysis.project_name}\n偏差: ${analysis.deviation}%\n状态: ${statusText[analysis.status] || analysis.status}`;
          const userIds = todoIds.map(t => t.userId);
          if (userIds.length > 0) {
            db.prepare(`
              INSERT INTO notifications (user_id, title, content, type, source_type, source_id)
              SELECT ?, ?, ?, 'warning', 'progress', ?
            `).run(userIds[0], notifTitle, notifContent, analysis.id);
            // 批量为其他用户创建
            const insertNotif = db.prepare(`
              INSERT INTO notifications (user_id, title, content, type, source_type, source_id)
              VALUES (?, ?, ?, 'warning', 'progress', ?)
            `);
            userIds.slice(1).forEach(uid => {
              insertNotif.run(uid, notifTitle, notifContent, analysis.id);
            });
          }
        } catch (notifErr) {
          console.error('发送站内通知失败:', notifErr.message);
        }
      }
    }
  }

  console.log(`进度预警推送完成: 共推送${pushedCount.total}个项目，紧急${pushedCount.urgent}个，高优先${pushedCount.high}个`);
  return pushedCount;
}

module.exports.pushProgressReport = pushProgressReport;
module.exports.runDailyProgressPush = runDailyProgressPush;
