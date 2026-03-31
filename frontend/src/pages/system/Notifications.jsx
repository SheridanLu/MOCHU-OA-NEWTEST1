/**
 * 通知管理页面
 * 查看所有站内通知、标记已读、删除
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Tag, Space, Tabs, Typography,
  Badge, message, Popconfirm, Tooltip
} from 'antd';
import {
  BellOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  DeleteOutlined,
  ReadOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;

const TYPE_CONFIG = {
  info: { color: 'blue', tag: '通知', tagColor: 'blue' },
  warning: { color: 'orange', tag: '预警', tagColor: 'orange' },
  urgent: { color: 'red', tag: '紧急', tagColor: 'red' },
  success: { color: 'green', tag: '成功', tagColor: 'green' },
  approval: { color: 'purple', tag: '审批', tagColor: 'purple' }
};

const SOURCE_MAP = {
  progress: '进度预警',
  approval: '审批通知',
  stock: '库存通知',
  contract: '合同通知',
  project: '项目通知'
};

function Notifications() {
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [activeTab, setActiveTab] = useState('all');

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      params.append('page', pagination.current);
      params.append('pageSize', pagination.pageSize);
      if (activeTab === 'unread') params.append('is_read', '0');
      if (activeTab === 'read') params.append('is_read', '1');

      const res = await fetch(`/api/notifications?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(data.data || []);
        setPagination(prev => ({ ...prev, total: data.pagination?.total || 0 }));
      }
    } catch (error) {
      message.error('获取通知失败');
    } finally {
      setLoading(false);
    }
  }, [activeTab, pagination.current, pagination.pageSize]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const markAsRead = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchNotifications();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const markAllRead = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/notifications/read-all', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        message.success(data.message);
        fetchNotifications();
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const deleteNotification = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      message.success('删除成功');
      fetchNotifications();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const columns = [
    {
      title: '状态',
      dataIndex: 'is_read',
      key: 'is_read',
      width: 80,
      render: (isRead) => (
        <Badge status={isRead ? 'default' : 'processing'} text={isRead ? '已读' : '未读'} />
      )
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (type) => {
        const config = TYPE_CONFIG[type] || TYPE_CONFIG.info;
        return <Tag color={config.tagColor}>{config.tag}</Tag>;
      }
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true
    },
    {
      title: '内容',
      dataIndex: 'content',
      key: 'content',
      width: 200,
      ellipsis: true,
      render: (text) => <Text type="secondary" style={{ fontSize: 12 }}>{text}</Text>
    },
    {
      title: '来源',
      dataIndex: 'source_type',
      key: 'source_type',
      width: 100,
      render: (type) => SOURCE_MAP[type] || type || '-'
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (text) => text ? dayjs(text).format('YYYY-MM-DD HH:mm') : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_, record) => (
        <Space size="small">
          {!record.is_read && (
            <Tooltip title="标记已读">
              <Button type="link" size="small" icon={<ReadOutlined />} onClick={() => markAsRead(record.id)} />
            </Tooltip>
          )}
          <Popconfirm title="确定删除？" onConfirm={() => deleteNotification(record.id)}>
            <Tooltip title="删除">
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => {
            setActiveTab(key);
            setPagination({ current: 1, pageSize: 20, total: 0 });
          }}
          items={[
            { key: 'all', label: '全部通知' },
            { key: 'unread', label: (
              <span>未读 <Badge count={pagination.total} size="small" style={{ marginLeft: 4 }} /></span>
            ) },
            { key: 'read', label: '已读' }
          ]}
          tabBarExtraContent={
            unreadCount > 0 && (
              <Button type="link" icon={<CheckCircleOutlined />} onClick={markAllRead}>
                全部标记已读
              </Button>
            )
          }
        />
        <Table
          columns={columns}
          dataSource={notifications}
          rowKey="id"
          loading={loading}
          size="middle"
          rowClassName={(record) => record.is_read ? '' : 'notification-unread-row'}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`
          }}
          onChange={(p) => setPagination({ ...pagination, current: p.current, pageSize: p.pageSize })}
        />
      </Card>
      <style>{`
        .notification-unread-row {
          background-color: #f6ffed;
        }
        .notification-unread-row:hover > td {
          background-color: #e6fffb !important;
        }
      `}</style>
    </div>
  );
}

export default Notifications;
