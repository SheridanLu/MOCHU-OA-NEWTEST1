import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, DatePicker, Select,
  message, Progress, Tag, Tooltip, Row, Col, Statistic, Space, Popconfirm,
  Dropdown, Menu, InputNumber, Checkbox, Divider, Alert
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, UnorderedListOutlined,
  AppstoreOutlined, CalendarOutlined, CheckCircleOutlined, ClockCircleOutlined,
  PlayCircleOutlined, PauseCircleOutlined, MoreOutlined, LinkOutlined,
  FlagOutlined, DragOutlined, WarningOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Option } = Select;
const { RangePicker } = DatePicker;

const API_BASE = '/api';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
}

// 状态颜色映射
const STATUS_COLORS = {
  pending: { bg: '#d9d9d9', text: '#666' },
  in_progress: { bg: '#1890ff', text: '#fff' },
  completed: { bg: '#52c41a', text: '#fff' },
  delayed: { bg: '#ff4d4f', text: '#fff' }
};

const STATUS_TEXT = {
  pending: '待开始',
  in_progress: '进行中',
  completed: '已完成',
  delayed: '延期'
};

// 里程碑颜色
const MILESTONE_COLORS = ['#1890ff', '#52c41a', '#faad14', '#eb2f96', '#722ed1', '#13c2c2'];

function TaskGantt() {
  const [loading, setLoading] = useState(false);
  const [projectId, setProjectId] = useState(null);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [viewMode, setViewMode] = useState('gantt');
  const [modalVisible, setModalVisible] = useState(false);
  const [progressModalVisible, setProgressModalVisible] = useState(false);
  const [dependencyModalVisible, setDependencyModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskDependencies, setTaskDependencies] = useState([]);
  const [availableTasks, setAvailableTasks] = useState([]);
  const [form] = Form.useForm();
  const [progressForm] = Form.useForm();
  const [dependencyForm] = Form.useForm();
  const [dragTask, setDragTask] = useState(null);
  const [dragType, setDragType] = useState(null); // 'move' or 'resize'
  const ganttRef = useRef(null);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (projectId) {
      loadGanttData();
    }
  }, [projectId]);

  const loadProjects = async () => {
    try {
      const response = await fetch(`${API_BASE}/projects?type=entity&pageSize=100`, {
        headers: getAuthHeaders()
      });
      const result = await response.json();
      if (result.success) {
        setProjects(result.data || []);
      }
    } catch (error) {
      console.error('加载项目失败:', error);
    }
  };

  const loadGanttData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/construction/tasks/gantt/${projectId}`, {
        headers: getAuthHeaders()
      });
      const result = await response.json();
      if (result.success) {
        setTasks(result.data.tasks || []);
        setMilestones(result.data.milestones || []);
      }
    } catch (error) {
      console.error('加载甘特图数据失败:', error);
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadTaskDependencies = async (taskId) => {
    try {
      const response = await fetch(`${API_BASE}/construction/tasks/${taskId}/dependencies`, {
        headers: getAuthHeaders()
      });
      const result = await response.json();
      if (result.success) {
        setTaskDependencies(result.data.dependencies || []);
      }
    } catch (error) {
      console.error('加载依赖关系失败:', error);
    }
  };

  const handleAddTask = (milestoneId = null) => {
    setEditingTask(null);
    form.resetFields();
    form.setFieldsValue({ projectId, milestoneId, progress: 0, priority: 'normal' });
    setModalVisible(true);
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    form.setFieldsValue({
      ...task,
      plannedDate: task.plannedStart && task.plannedEnd ? 
        [dayjs(task.plannedStart), dayjs(task.plannedEnd)] : null,
      actualDate: task.actualStart && task.actualEnd ?
        [dayjs(task.actualStart), dayjs(task.actualEnd)] : null
    });
    setModalVisible(true);
  };

  const handleDeleteTask = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/construction/tasks/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const result = await response.json();
      if (result.success) {
        message.success('删除成功');
        loadGanttData();
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleUpdateProgress = (task) => {
    setSelectedTask(task);
    progressForm.setFieldsValue({ progressRate: task.progress || 0, status: task.status });
    setProgressModalVisible(true);
  };

  const handleManageDependencies = (task) => {
    setSelectedTask(task);
    setAvailableTasks(tasks.filter(t => t.id !== task.id));
    loadTaskDependencies(task.id);
    dependencyForm.setFieldsValue({
      dependencies: []
    });
    setDependencyModalVisible(true);
  };

  const handleSubmitProgress = async (values) => {
    try {
      const response = await fetch(`${API_BASE}/construction/tasks/${selectedTask.id}/progress`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(values)
      });
      const result = await response.json();
      if (result.success) {
        message.success('进度更新成功');
        setProgressModalVisible(false);
        loadGanttData();
      }
    } catch (error) {
      message.error('更新失败');
    }
  };

  const handleSubmitDependencies = async (values) => {
    try {
      const response = await fetch(`${API_BASE}/construction/tasks/${selectedTask.id}/dependencies`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(values)
      });
      const result = await response.json();
      if (result.success) {
        message.success('依赖关系设置成功');
        setDependencyModalVisible(false);
        loadGanttData();
      }
    } catch (error) {
      message.error('设置失败');
    }
  };

  const handleSubmit = async (values) => {
    console.log('handleSubmit 被调用, values:', values);
    try {
      const data = {
        ...values,
        plannedStartDate: values.plannedDate?.[0]?.format('YYYY-MM-DD'),
        plannedEndDate: values.plannedDate?.[1]?.format('YYYY-MM-DD'),
        actualStartDate: values.actualDate?.[0]?.format('YYYY-MM-DD'),
        actualEndDate: values.actualDate?.[1]?.format('YYYY-MM-DD')
      };
      delete data.plannedDate;
      delete data.actualDate;

      const url = editingTask
        ? `${API_BASE}/construction/tasks/${editingTask.id}`
        : `${API_BASE}/construction/tasks`;
      const method = editingTask ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
      });

      const result = await response.json();
      if (result.success) {
        message.success(editingTask ? '更新成功' : '创建成功');
        setModalVisible(false);
        loadGanttData();
      } else {
        message.error(result.message || '操作失败');
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  // 拖拽更新日期
  const handleDragStart = (e, task, type) => {
    e.preventDefault();
    setDragTask(task);
    setDragType(type);
    
    const startX = e.clientX;
    const taskStart = dayjs(task.plannedStart);
    const taskEnd = dayjs(task.plannedEnd);

    const handleMouseMove = async (moveEvent) => {
      if (!ganttRef.current) return;
      
      const deltaX = moveEvent.clientX - startX;
      const dayWidth = ganttRef.current.offsetWidth / dateRange.days;
      const deltaDays = Math.round(deltaX / dayWidth);

      if (type === 'move') {
        const newStart = taskStart.add(deltaDays, 'day');
        const newEnd = taskEnd.add(deltaDays, 'day');
        // 实时更新UI
      } else if (type === 'resize-left') {
        const newStart = taskStart.add(deltaDays, 'day');
        // 实时更新UI
      } else if (type === 'resize-right') {
        const newEnd = taskEnd.add(deltaDays, 'day');
        // 实时更新UI
      }
    };

    const handleMouseUp = async (upEvent) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      const deltaX = upEvent.clientX - startX;
      const dayWidth = ganttRef.current.offsetWidth / dateRange.days;
      const deltaDays = Math.round(deltaX / dayWidth);

      let newStart = taskStart;
      let newEnd = taskEnd;

      if (type === 'move') {
        newStart = taskStart.add(deltaDays, 'day');
        newEnd = taskEnd.add(deltaDays, 'day');
      } else if (type === 'resize-left') {
        newStart = taskStart.add(deltaDays, 'day');
      } else if (type === 'resize-right') {
        newEnd = taskEnd.add(deltaDays, 'day');
      }

      // 确保开始日期不大于结束日期
      if (newStart.isAfter(newEnd)) {
        [newStart, newEnd] = [newEnd, newStart];
      }

      // 更新到服务器
      try {
        await fetch(`${API_BASE}/construction/tasks/${task.id}/dates`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            plannedStartDate: newStart.format('YYYY-MM-DD'),
            plannedEndDate: newEnd.format('YYYY-MM-DD')
          })
        });
        loadGanttData();
      } catch (error) {
        message.error('更新失败');
      }

      setDragTask(null);
      setDragType(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // 计算甘特图日期范围
  const dateRange = useMemo(() => {
    if (tasks.length === 0) {
      const today = dayjs();
      return { start: today, end: today.add(1, 'month'), days: 31 };
    }

    let minDate = dayjs(tasks[0].plannedStart || dayjs());
    let maxDate = dayjs(tasks[0].plannedEnd || dayjs());

    tasks.forEach(task => {
      if (task.plannedStart) {
        const start = dayjs(task.plannedStart);
        if (start.isBefore(minDate)) minDate = start;
      }
      if (task.plannedEnd) {
        const end = dayjs(task.plannedEnd);
        if (end.isAfter(maxDate)) maxDate = end;
      }
    });

    minDate = minDate.subtract(3, 'day');
    maxDate = maxDate.add(7, 'day');
    const days = maxDate.diff(minDate, 'day') + 1;

    return { start: minDate, end: maxDate, days };
  }, [tasks]);

  // 生成日期数组
  const dates = useMemo(() => {
    const arr = [];
    let current = dateRange.start.clone();
    while (current.isBefore(dateRange.end) || current.isSame(dateRange.end, 'day')) {
      arr.push(current.clone());
      current = current.add(1, 'day');
    }
    return arr;
  }, [dateRange]);

  // 计算任务条位置
  const getTaskPosition = (task) => {
    if (!task.plannedStart || !task.plannedEnd) return null;

    const start = dayjs(task.plannedStart);
    const end = dayjs(task.plannedEnd);

    const left = start.diff(dateRange.start, 'day');
    const width = end.diff(start, 'day') + 1;

    return { 
      left: `${(left / dateRange.days) * 100}%`, 
      width: `${(width / dateRange.days) * 100}%` 
    };
  };

  // 计算今日线位置
  const getTodayPosition = () => {
    const today = dayjs();
    if (today.isBefore(dateRange.start) || today.isAfter(dateRange.end)) return null;
    const left = today.diff(dateRange.start, 'day');
    return `${(left / dateRange.days) * 100}%`;
  };

  const todayPos = getTodayPosition();

  // 按里程碑分组任务
  const tasksByMilestone = useMemo(() => {
    const grouped = { '无里程碑': [] };
    milestones.forEach(m => {
      grouped[m.name] = [];
    });
    
    tasks.forEach(task => {
      const milestone = milestones.find(m => m.id === task.milestoneId);
      const key = milestone ? milestone.name : '无里程碑';
      if (grouped[key]) {
        grouped[key].push(task);
      } else {
        grouped[key] = [task];
      }
    });

    return grouped;
  }, [tasks, milestones]);

  // 列表视图列定义
  const columns = [
    {
      title: '任务编号',
      dataIndex: 'taskNo',
      width: 130,
      fixed: 'left'
    },
    {
      title: '任务名称',
      dataIndex: 'name',
      ellipsis: true,
      fixed: 'left',
      width: 200
    },
    {
      title: '里程碑',
      dataIndex: 'milestoneId',
      width: 120,
      render: (milestoneId) => {
        const m = milestones.find(m => m.id === milestoneId);
        return m ? <Tag color="blue">{m.name}</Tag> : '-';
      }
    },
    {
      title: '计划开始',
      dataIndex: 'plannedStart',
      width: 100
    },
    {
      title: '计划完成',
      dataIndex: 'plannedEnd',
      width: 100
    },
    {
      title: '进度',
      dataIndex: 'progress',
      width: 150,
      render: (val, record) => (
        <div onClick={() => handleUpdateProgress(record)} style={{ cursor: 'pointer' }}>
          <Progress percent={val || 0} size="small" />
        </div>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (status) => (
        <Tag color={STATUS_COLORS[status]?.bg || '#d9d9d9'} style={{ color: STATUS_COLORS[status]?.text }}>
          {STATUS_TEXT[status] || status}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleEditTask(record)}>编辑</Button>
          <Button type="link" size="small" onClick={() => handleManageDependencies(record)}>依赖</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDeleteTask(record.id)}>
            <Button type="link" size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  // 统计数据
  const stats = useMemo(() => ({
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    delayed: tasks.filter(t => t.status === 'delayed').length,
    avgProgress: tasks.length > 0 
      ? Math.round(tasks.reduce((sum, t) => sum + (t.progress || 0), 0) / tasks.length)
      : 0,
    milestoneCount: milestones.length
  }), [tasks, milestones]);

  return (
    <div style={{ padding: '24px' }}>
      <Card 
        title={
          <span>
            <AppstoreOutlined style={{ marginRight: 8 }} />
            任务甘特图
          </span>
        }
        extra={
          <Space>
            <Select
              style={{ width: 280 }}
              placeholder="选择项目"
              value={projectId}
              onChange={setProjectId}
              showSearch
              optionFilterProp="children"
            >
              {projects.map(p => (
                <Option key={p.id} value={p.id}>{p.project_no} - {p.name}</Option>
              ))}
            </Select>
            <Button.Group>
              <Button
                type={viewMode === 'gantt' ? 'primary' : 'default'}
                icon={<AppstoreOutlined />}
                onClick={() => setViewMode('gantt')}
              >
                甘特图
              </Button>
              <Button
                type={viewMode === 'list' ? 'primary' : 'default'}
                icon={<UnorderedListOutlined />}
                onClick={() => setViewMode('list')}
              >
                列表
              </Button>
            </Button.Group>
            <Dropdown overlay={
              <Menu>
                {milestones.map(m => (
                  <Menu.Item key={m.id} onClick={() => handleAddTask(m.id)}>
                    <FlagOutlined style={{ color: '#1890ff' }} /> 添加到: {m.name}
                  </Menu.Item>
                ))}
                <Menu.Divider />
                <Menu.Item key="none" onClick={() => handleAddTask(null)}>
                  <PlusOutlined /> 添加独立任务
                </Menu.Item>
              </Menu>
            }>
              <Button type="primary" icon={<PlusOutlined />}>
                新建任务
              </Button>
            </Dropdown>
          </Space>
        }
      >
        {projectId && (
          <>
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={3}>
                <Statistic title="任务总数" value={stats.total} />
              </Col>
              <Col span={3}>
                <Statistic title="里程碑" value={stats.milestoneCount} />
              </Col>
              <Col span={3}>
                <Statistic title="待开始" value={stats.pending} valueStyle={{ color: '#999' }} />
              </Col>
              <Col span={3}>
                <Statistic title="进行中" value={stats.inProgress} valueStyle={{ color: '#1890ff' }} />
              </Col>
              <Col span={3}>
                <Statistic title="已完成" value={stats.completed} valueStyle={{ color: '#52c41a' }} />
              </Col>
              <Col span={3}>
                <Statistic title="延期" value={stats.delayed} valueStyle={{ color: '#ff4d4f' }} />
              </Col>
              <Col span={3}>
                <Statistic title="平均进度" value={stats.avgProgress} suffix="%" />
              </Col>
            </Row>

            {/* 里程碑标签 */}
            {milestones.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <span style={{ marginRight: 8 }}>里程碑:</span>
                {milestones.map((m, idx) => (
                  <Tag key={m.id} color={MILESTONE_COLORS[idx % MILESTONE_COLORS.length]}>
                    <FlagOutlined /> {m.name}
                  </Tag>
                ))}
              </div>
            )}
          </>
        )}

        {projectId ? (
          viewMode === 'gantt' ? (
            // 甘特图视图
            <div style={{ overflow: 'auto' }} ref={ganttRef}>
              {/* 日期头部 */}
              <div style={{
                display: 'flex',
                borderBottom: '1px solid #f0f0f0',
                background: '#fafafa',
                position: 'sticky',
                top: 0,
                zIndex: 10
              }}>
                <div style={{ width: 280, minWidth: 280, padding: '8px 12px', fontWeight: 'bold', borderRight: '1px solid #f0f0f0' }}>
                  任务名称
                </div>
                <div style={{ flex: 1, display: 'flex' }}>
                  {dates.map((date, idx) => {
                    const isWeekend = date.day() === 0 || date.day() === 6;
                    return (
                      <div key={idx} style={{
                        width: `${100 / dateRange.days}%`,
                        minWidth: 32,
                        padding: '8px 4px',
                        textAlign: 'center',
                        fontSize: 12,
                        borderRight: '1px solid #f0f0f0',
                        background: isWeekend ? '#f5f5f5' : 'inherit'
                      }}>
                        <div>{date.format('DD')}</div>
                        <div style={{ fontSize: 10, color: '#999' }}>{date.format('MM')}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 按里程碑分组显示任务 */}
              {Object.entries(tasksByMilestone).map(([milestoneName, milestoneTasks]) => (
                milestoneTasks.length > 0 && (
                  <div key={milestoneName}>
                    {/* 里程碑标题行 */}
                    <div style={{
                      display: 'flex',
                      background: '#e6f7ff',
                      borderBottom: '1px solid #91d5ff',
                      fontWeight: 600
                    }}>
                      <div style={{ width: 280, minWidth: 280, padding: '8px 12px', borderRight: '1px solid #f0f0f0' }}>
                        <FlagOutlined style={{ color: '#1890ff', marginRight: 8 }} />
                        {milestoneName}
                        <span style={{ fontWeight: 'normal', color: '#999', marginLeft: 8 }}>
                          ({milestoneTasks.length}个任务)
                        </span>
                      </div>
                      <div style={{ flex: 1 }} />
                    </div>

                    {/* 该里程碑下的任务 */}
                    {milestoneTasks.map((task, rowIdx) => {
                      const position = getTaskPosition(task);
                      const statusColor = STATUS_COLORS[task.status] || STATUS_COLORS.pending;

                      return (
                        <div 
                          key={task.id} 
                          style={{ 
                            display: 'flex',
                            borderBottom: '1px solid #f0f0f0',
                            background: rowIdx % 2 === 0 ? '#fff' : '#fafafa',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#e6f7ff'}
                          onMouseLeave={(e) => e.currentTarget.style.background = rowIdx % 2 === 0 ? '#fff' : '#fafafa'}
                        >
                          {/* 任务名称列 */}
                          <div style={{ 
                            width: 280, 
                            minWidth: 280, 
                            padding: '10px 16px', 
                            borderRight: '1px solid #f0f0f0',
                            display: 'flex',
                            alignItems: 'center'
                          }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 500 }}>{task.name}</div>
                              <div style={{ fontSize: 12, color: '#999', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span>{task.taskNo}</span>
                                <Tag 
                                  color={statusColor.bg} 
                                  style={{ margin: 0, fontSize: 10, color: statusColor.text, border: 'none' }}
                                >
                                  {STATUS_TEXT[task.status]}
                                </Tag>
                                {task.assignee && <span>{task.assignee}</span>}
                              </div>
                            </div>
                            {/* 删除按钮 */}
                            <Popconfirm title="确认删除此任务？" onConfirm={() => handleDeleteTask(task.id)}>
                              <DeleteOutlined 
                                style={{ 
                                  color: '#ff4d4f', 
                                  cursor: 'pointer',
                                  opacity: 0.5,
                                  transition: 'opacity 0.2s'
                                }}
                                onMouseEnter={(e) => e.target.style.opacity = 1}
                                onMouseLeave={(e) => e.target.style.opacity = 0.5}
                              />
                            </Popconfirm>
                          </div>

                          {/* 甘特图列 */}
                          <div style={{ 
                            flex: 1, 
                            display: 'flex', 
                            position: 'relative', 
                            minHeight: 56,
                            overflow: 'hidden'
                          }}>
                            {/* 日期背景格 */}
                            {dates.map((date, idx) => {
                              const isWeekend = date.day() === 0 || date.day() === 6;
                              return (
                                <div key={idx} style={{ 
                                  flex: 1, 
                                  minWidth: 32,
                                  borderRight: '1px solid #f0f0f0',
                                  background: isWeekend ? '#fafafa' : 'transparent'
                                }} />
                              );
                            })}

                            {/* 今日线 */}
                            {todayPos && (
                              <div style={{
                                position: 'absolute',
                                left: todayPos,
                                top: 0,
                                bottom: 0,
                                width: 2,
                                background: '#ff4d4f',
                                zIndex: 5
                              }}>
                                <div style={{
                                  position: 'absolute',
                                  top: -6,
                                  left: -12,
                                  fontSize: 10,
                                  color: '#ff4d4f',
                                  whiteSpace: 'nowrap'
                                }}>今日</div>
                              </div>
                            )}

                            {/* 任务条 */}
                            {position && (
                              <Tooltip 
                                title={
                                  <div>
                                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{task.name}</div>
                                    <div>计划: {task.plannedStart} ~ {task.plannedEnd}</div>
                                    {task.actualStart && <div>实际开始: {task.actualStart}</div>}
                                    <div>进度: {task.progress || 0}%</div>
                                    {task.assignee && <div>负责人: {task.assignee}</div>}
                                    <div style={{ marginTop: 4, color: '#aaa' }}>拖拽调整 | 双击编辑</div>
                                  </div>
                                }
                                placement="top"
                              >
                                <div
                                  style={{
                                    position: 'absolute',
                                    left: position.left,
                                    width: position.width,
                                    minWidth: 20,
                                    top: 12,
                                    height: 32,
                                    background: statusColor.bg,
                                    borderRadius: 4,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                    zIndex: 10,
                                    overflow: 'hidden',
                                    cursor: 'move'
                                  }}
                                  onClick={() => handleEditTask(task)}
                                  onMouseDown={(e) => handleDragStart(e, task, 'move')}
                                >
                                  {/* 进度条 */}
                                  <div style={{
                                    position: 'absolute',
                                    left: 0,
                                    top: 0,
                                    bottom: 0,
                                    width: `${task.progress || 0}%`,
                                    background: 'rgba(255,255,255,0.25)',
                                    transition: 'width 0.3s'
                                  }} />
                                  {/* 进度文字 */}
                                  <span style={{ 
                                    position: 'relative', 
                                    zIndex: 1,
                                    color: statusColor.text,
                                    fontSize: 12,
                                    fontWeight: 500
                                  }}>
                                    {task.progress || 0}%
                                  </span>
                                </div>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ))}

              {tasks.length === 0 && (
                <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>
                  暂无任务，请先创建里程碑和任务
                </div>
              )}
            </div>
          ) : (
            // 列表视图
            <Table
              columns={columns}
              dataSource={tasks}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 20 }}
            />
          )
        ) : (
          <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>
            请先选择项目
          </div>
        )}
      </Card>

      {/* 新建/编辑任务弹窗 */}
      <Modal
        title={editingTask ? '编辑任务' : '新建任务'}
        open={modalVisible}
        onOk={() => {
          form.validateFields()
            .then(values => {
              handleSubmit(values);
            })
            .catch(errorInfo => {
              console.log('表单验证失败:', errorInfo);
              message.error('请填写必填字段');
            });
        }}
        onCancel={() => setModalVisible(false)}
        width={700}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="projectId" label="项目" rules={[{ required: true }]}>
                <Select disabled={!!editingTask}>
                  {projects.map(p => (
                    <Option key={p.id} value={p.id}>{p.project_no} - {p.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="milestoneId" label="关联里程碑">
                <Select allowClear placeholder="选择里程碑（可选）">
                  {milestones.map(m => (
                    <Option key={m.id} value={m.id}>{m.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="name" label="任务名称" rules={[{ required: true, message: '请输入任务名称' }]}>
            <Input placeholder="请输入任务名称" maxLength={100} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="plannedDate" label="计划日期">
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="actualDate" label="实际日期">
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="assigneeId" label="负责人">
                <Select allowClear placeholder="选择负责人">
                  {/* 可以添加用户列表 */}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="状态">
                <Select>
                  <Option value="pending">待开始</Option>
                  <Option value="in_progress">进行中</Option>
                  <Option value="completed">已完成</Option>
                  <Option value="delayed">延期</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="priority" label="优先级">
                <Select>
                  <Option value="low">低</Option>
                  <Option value="normal">普通</Option>
                  <Option value="high">高</Option>
                  <Option value="urgent">紧急</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {editingTask && (
            <Form.Item name="progress" label="完成进度">
              <InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="%" />
            </Form.Item>
          )}

          <Form.Item name="description" label="任务描述">
            <Input.TextArea rows={3} placeholder="请输入任务描述" maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 更新进度弹窗 */}
      <Modal
        title="更新任务进度"
        open={progressModalVisible}
        onOk={() => {
          progressForm.validateFields()
            .then(values => handleSubmitProgress(values))
            .catch(errorInfo => {
              console.log('表单验证失败:', errorInfo);
              message.error('请填写必填字段');
            });
        }}
        onCancel={() => setProgressModalVisible(false)}
        width={400}
        destroyOnClose
      >
        {selectedTask && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600 }}>{selectedTask.name}</div>
            <div style={{ color: '#999', fontSize: 12 }}>{selectedTask.taskNo}</div>
          </div>
        )}
        <Form
          form={progressForm}
          layout="vertical"
          onFinish={handleSubmitProgress}
        >
          <Form.Item 
            name="progressRate" 
            label="完成进度" 
            rules={[{ required: true, message: '请输入进度' }]}
          >
            <InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="%" />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select>
              <Option value="pending">待开始</Option>
              <Option value="in_progress">进行中</Option>
              <Option value="completed">已完成</Option>
              <Option value="delayed">延期</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 依赖关系弹窗 */}
      <Modal
        title="设置任务依赖"
        open={dependencyModalVisible}
        onOk={() => {
          dependencyForm.validateFields()
            .then(values => handleSubmitDependencies(values))
            .catch(errorInfo => {
              console.log('表单验证失败:', errorInfo);
              message.error('请填写必填字段');
            });
        }}
        onCancel={() => setDependencyModalVisible(false)}
        width={600}
        destroyOnClose
      >
        {selectedTask && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600 }}>{selectedTask.name}</div>
            <div style={{ color: '#999', fontSize: 12 }}>{selectedTask.taskNo}</div>
          </div>
        )}

        <Alert 
          message="任务依赖说明" 
          description="设置任务之间的依赖关系，当前任务将在前置任务完成后才能开始。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Form
          form={dependencyForm}
          layout="vertical"
          onFinish={handleSubmitDependencies}
        >
          <Form.Item 
            name="dependencies" 
            label="前置任务"
            tooltip="选择必须在当前任务开始前完成的任务"
          >
            <Select
              mode="multiple"
              placeholder="选择前置任务"
              style={{ width: '100%' }}
            >
              {availableTasks.map(t => (
                <Option key={t.id} value={t.id}>
                  {t.taskNo} - {t.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>

        {/* 现有依赖关系 */}
        {taskDependencies.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>当前依赖:</div>
            {taskDependencies.map(dep => (
              <Tag key={dep.id} closable style={{ marginBottom: 4 }}>
                {dep.depends_on_task_name || `任务#${dep.depends_on_task_id}`}
              </Tag>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default TaskGantt;
