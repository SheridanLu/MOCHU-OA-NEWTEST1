/**
 * 站内通知组件 - 头部铃铛图标
 * PRD 14: 显示未读通知数量，点击查看通知列表
 */
import React, { useState, useEffect, useRef } from 'react';
import { Badge, Popover, List, Button, Tag, Empty, Tabs, Typography, Spin } from 'antd';
import {
  BellOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { Text } = Typography;

const TYPE_CONFIG = {
  info: { color: 'blue', icon: <InfoCircleOutlined />, tag: '通知' },
  warning: { color: 'orange', icon: <WarningOutlined />, tag: '预警' },
  urgent: { color: 'red', icon: <ExclamationCircleOutlined />, tag: '紧急' },
  success: { color: 'green', icon: <CheckCircleOutlined />, tag: '成功' },
  approval: { color: 'purple', icon: <CheckCircleOutlined />, tag: '审批' }
};

function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('unread');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const popoverRef = useRef(null);

  const fetchUnreadCount = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/notifications/unread-count', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setUnread(data.data.unread || 0);
      }
    } catch (e) { /* silent */ }
  };

  const fetchNotifications = async (reset = true) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      params.append('page', reset ? '1' : page);
      params.append('pageSize', '10');
      if (tab === 'unread') params.append('is_read', '0');
      if (tab === 'read') params.append('is_read', '1');

      const res = await fetch(`/api/notifications?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(reset ? data.data : [...notifications, ...data.data]);
        setHasMore(data.data.length >= 10);
        if (reset) setPage(1);
        else setPage(p => p + 1);
      }
    } catch (e) { /* silent */ }
    setLoading(false);
  };

  const markAsRead = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1, read_at: new Date().toISOString() } : n));
      fetchUnreadCount();
    } catch (e) { /* silent */ }
  };

  const markAllRead = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/notifications/read-all', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      setUnread(0);
    } catch (e) { /* silent */ }
  };

  useEffect(() => { fetchUnreadCount(); }, []);
  // 每60秒刷新未读数
  useEffect(() => {
    const timer = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (open) fetchNotifications(true);
  }, [open, tab]);

  const handleClick = (record) => {
    if (!record.is_read) markAsRead(record.id);
    // 如果有source_type和source_id，可以跳转
    if (record.source_type && record.source_id) {
      setOpen(false);
    }
  };

  const notificationList = (
    <div style={{ width: 380, maxHeight: 480 }}>
      <Tabs
        activeKey={tab}
        onChange={(key) => { setTab(key); }}
        size="small"
        items={[
          { key: 'unread', label: `未读 (${unread})` },
          { key: 'read', label: '已读' },
          { key: 'all', label: '全部' }
        ]}
      />
      {tab === 'unread' && unread > 0 && (
        <div style={{ padding: '4px 12px', borderBottom: '1px solid #f0f0f0' }}>
          <Button type="link" size="small" onClick={markAllRead}>全部标记已读</Button>
        </div>
      )}
      <Spin spinning={loading}>
        <List
          dataSource={notifications}
          style={{ maxHeight: 380, overflow: 'auto' }}
          locale={{ emptyText: <Empty description="暂无通知" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          renderItem={(item) => {
            const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.info;
            return (
              <List.Item
                style={{
                  padding: '8px 12px',
                  background: item.is_read ? 'transparent' : '#f6ffed',
                  cursor: 'pointer',
                  borderRadius: 4
                }}
                onClick={() => handleClick(item)}
                actions={[
                  <Button
                    key="read"
                    type="text"
                    size="small"
                    icon={<CheckCircleOutlined />}
                    style={{ color: item.is_read ? '#d9d9d9' : '#52c41a' }}
                    onClick={(e) => { e.stopPropagation(); markAsRead(item.id); }}
                  />
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <Badge dot={!item.is_read} offset={0}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: `${config.color}15`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: config.color, fontSize: 16
                      }}>
                        {config.icon}
                      </div>
                    </Badge>
                  }
                  title={
                    <Text strong={!item.is_read} style={{ fontSize: 13 }}>
                      {item.title}
                    </Text>
                  }
                  description={
                    <div>
                      <Text type="secondary" style={{ fontSize: 12, display: 'block', lineHeight: '20px' }}>
                        {item.content && item.content.length > 60 ? item.content.substring(0, 60) + '...' : item.content}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {item.created_at ? dayjs(item.created_at).fromNow() : ''}
                      </Text>
                    </div>
                  }
                />
              </List.Item>
            );
          }}
        />
        {hasMore && (
          <div style={{ textAlign: 'center', padding: 8 }}>
            <Button type="link" size="small" onClick={() => fetchNotifications(false)} loading={loading}>
              加载更多
            </Button>
          </div>
        )}
      </Spin>
    </div>
  );

  return (
    <Popover
      content={notificationList}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottomRight"
      arrow={false}
    >
      <div style={{ cursor: 'pointer', position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
        <BellOutlined style={{ fontSize: 18, color: unread > 0 ? '#1890ff' : '#999' }} />
        {unread > 0 && (
          <Badge
            count={unread > 99 ? '99+' : unread}
            size="small"
            style={{
              position: 'absolute',
              top: -8,
              right: -10
            }}
          />
        )}
      </div>
    </Popover>
  );
}

export default NotificationBell;
