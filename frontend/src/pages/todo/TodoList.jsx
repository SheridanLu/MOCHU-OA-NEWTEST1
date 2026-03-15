import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Modal, Descriptions, Statistic, Row, Col, message, Tabs, List, Badge } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined, BellOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const API_BASE = '/api';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
}

function TodoList() {
  const [loading, setLoading] = useState(false);
  const [todos, setTodos] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, in_progress: 0, completed: 0, urgent: 0 });
  const [activeTab, setActiveTab] = useState('pending');
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentTodo, setCurrentTodo] = useState(null);

  useEffect(() => {
    loadTodos();
    loadStats();
  }, [activeTab]);

  const loadTodos = async () => {
    setLoading(true);
    try {
      const status = activeTab === 'all' ? '' : activeTab;
      const response = await fetch(`${API_BASE}/todos?status=${status}&pageSize=50`, {
        headers: getAuthHeaders()
      });
      const result = await response.json();
      if (result.success) {
        setTodos(result.data || []);
      }
    } catch (error) {
      console.error('加载待办失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/todos/stats`, {
        headers: getAuthHeaders()
      });
      const result = await response.json();
      if (result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('加载统计失败:', error);
    }
  };

  const handleComplete = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/todos/${id}/complete`, {
        method: 'PUT',
        headers: getAuthHeaders()
      });
      const result = await response.json();
      if (result.success) {
        message.success('待办已完成');
        loadTodos();
        loadStats();
      }
    } catch (error) {
      console.error('完成待办失败:', error);
      message.error('操作失败');
    }
  };

  const handleViewDetail = (todo) => {
    setCurrentTodo(todo);
    setDetailVisible(true);
  };

  const getPriorityTag = (priority) => {
    const map = {
      'urgent': { color: 'red', text: '紧急' },
      'high': { color: 'orange', text: '高' },
      'normal': { color: 'blue', text: '普通' },
      'low': { color: 'default', text: '低' }
    };
    const info = map[priority] || map['normal'];
    return <Tag color={info.color}>{info.text}</Tag>;
  };

  const getTypeTag = (type) => {
    const map = {
      'progress_alert': { color: 'purple', text: '进度预警' },
      'approval': { color: 'cyan', text: '审批' },
      'general': { color: 'default', text: '常规' }
    };
    const info = map[type] || map['general'];
    return <Tag color={info.color}>{info.text}</Tag>;
  };

  const columns = [
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (val) => getPriorityTag(val)
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (val) => getTypeTag(val)
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (val, record) => (
        <a onClick={() => handleViewDetail(record)}>{val}</a>
      )
    },
    {
      title: '关联项目',
      dataIndex: 'project_name',
      key: 'project_name',
      width: 150,
      ellipsis: true,
      render: (val, record) => val ? `${record.project_no} - ${val}` : '-'
    },
    {
      title: '截止日期',
      dataIndex: 'due_date',
      key: 'due_date',
      width: 100,
      render: (val) => {
        if (!val) return '-';
        const isOverdue = dayjs(val).isBefore(dayjs(), 'day');
        return (
          <span style={{ color: isOverdue ? '#ff4d4f' : 'inherit' }}>
            {val}
          </span>
        );
      }
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (val) => dayjs(val).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        record.status !== 'completed' && (
          <Button type="link" onClick={() => handleComplete(record.id)}>
            完成
          </Button>
        )
      )
    }
  ];

  const tabItems = [
    { key: 'pending', label: `待处理 (${stats.pending})` },
    { key: 'completed', label: `已完成 (${stats.completed})` },
    { key: 'all', label: `全部 (${stats.total})` }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card title={
        <span><BellOutlined /> 我的待办</span>
      }>
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={4}>
            <Statistic title="待处理" value={stats.pending} valueStyle={{ color: '#faad14' }} />
          </Col>
          <Col span={4}>
            <Statistic title="紧急" value={stats.urgent} valueStyle={{ color: '#ff4d4f' }} />
          </Col>
          <Col span={4}>
            <Statistic title="已完成" value={stats.completed} valueStyle={{ color: '#52c41a' }} />
          </Col>
          <Col span={4}>
            <Statistic title="进行中" value={stats.in_progress} />
          </Col>
        </Row>

        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

        <Table
          columns={columns}
          dataSource={todos}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      {/* 详情弹窗 */}
      <Modal
        title="待办详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={
          currentTodo && currentTodo.status !== 'completed' ? (
            <Button type="primary" onClick={() => {
              handleComplete(currentTodo.id);
              setDetailVisible(false);
            }}>
              标记完成
            </Button>
          ) : null
        }
        width={600}
      >
        {currentTodo && (
          <div>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="标题">{currentTodo.title}</Descriptions.Item>
              <Descriptions.Item label="优先级">{getPriorityTag(currentTodo.priority)}</Descriptions.Item>
              <Descriptions.Item label="类型">{getTypeTag(currentTodo.type)}</Descriptions.Item>
              <Descriptions.Item label="关联项目">
                {currentTodo.project_name ? `${currentTodo.project_no} - ${currentTodo.project_name}` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="截止日期">{currentTodo.due_date || '-'}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={currentTodo.status === 'completed' ? 'green' : 'orange'}>
                  {currentTodo.status === 'completed' ? '已完成' : '待处理'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {dayjs(currentTodo.created_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
            </Descriptions>

            <Card size="small" title="详细内容" style={{ marginTop: 16 }}>
              <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{currentTodo.content}</pre>
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default TodoList;
