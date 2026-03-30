/**
 * 附件管理页面
 * PRD 12: 附件上传下载管理
 * 支持按实体类型筛选、上传、下载、删除
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Space, Select, Modal, Upload, message,
  Tag, Popconfirm, Descriptions, Typography, Tooltip, Row, Col, Statistic
} from 'antd';
import {
  UploadOutlined, DownloadOutlined, DeleteOutlined, EyeOutlined,
  CloudUploadOutlined, InboxOutlined, FileTextOutlined, PictureOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Option } = Select;
const { Text } = Typography;
const { Dragger } = Upload;

const API_BASE = window.location.origin + '/api';

function getHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`
  };
}

const ENTITY_TYPE_MAP = {
  visa: { text: '现场签证', color: 'orange' },
  owner_change: { text: '甲方需求变更', color: 'purple' },
  overage: { text: '超量采购变更', color: 'red' },
  contract: { text: '合同附件', color: 'blue' },
  project: { text: '项目附件', color: 'green' },
  bid_notice: { text: '中标通知书', color: 'cyan' }
};

const Attachments = () => {
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState({ entity_type: '', entity_id: '' });
  const [uploadVisible, setUploadVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentDetail, setCurrentDetail] = useState(null);

  const fetchAttachments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.entity_type) params.append('entity_type', filters.entity_type);
      if (filters.entity_id) params.append('entity_id', filters.entity_id);
      params.append('page', pagination.current);
      params.append('pageSize', pagination.pageSize);

      const res = await fetch(`${API_BASE}/attachments?${params}`, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setAttachments(data.data || []);
        setPagination(prev => ({ ...prev, total: data.pagination?.total || 0 }));
      }
    } catch (error) {
      message.error('获取附件列表失败');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.current, pagination.pageSize]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/attachments/stats/overview`, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('获取统计失败:', error);
    }
  }, []);

  useEffect(() => { fetchAttachments(); }, [fetchAttachments]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleDownload = async (record) => {
    try {
      const res = await fetch(`${API_BASE}/attachments/${record.id}/download`, {
        headers: getHeaders()
      });
      if (!res.ok) throw new Error('下载失败');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = record.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      message.error('下载失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/attachments/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        message.success('附件删除成功');
        fetchAttachments();
        fetchStats();
      } else {
        message.error(data.message || '删除失败');
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const uploadProps = {
    name: 'file',
    multiple: true,
    action: `${API_BASE}/attachments/upload-multiple`,
    headers: getHeaders(),
    data: (file) => ({
      entity_type: filters.entity_type || 'project',
      entity_id: filters.entity_id || ''
    }),
    onChange(info) {
      if (info.file.status === 'done') {
        message.success(`${info.file.name} 上传成功`);
        fetchAttachments();
        fetchStats();
      } else if (info.file.status === 'error') {
        const errMsg = info.file.response?.message || '上传失败';
        message.error(`${info.file.name}: ${errMsg}`);
      }
    },
    beforeUpload(file) {
      const maxSize = 50 * 1024 * 1024;
      if (file.size > maxSize) {
        message.error(`${file.name} 超过50MB限制`);
        return Upload.LIST_IGNORE;
      }
      return true;
    }
  };

  const handleViewDetail = (record) => {
    setCurrentDetail(record);
    setDetailVisible(true);
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) {
      size /= 1024;
      i++;
    }
    return `${size.toFixed(1)} ${units[i]}`;
  };

  const getFileIcon = (fileType) => {
    if (!fileType) return <FileTextOutlined />;
    if (fileType.startsWith('image/')) return <PictureOutlined style={{ color: '#52c41a' }} />;
    if (fileType.includes('pdf')) return <FileTextOutlined style={{ color: '#ff4d4f' }} />;
    return <FileTextOutlined style={{ color: '#1890ff' }} />;
  };

  const columns = [
    {
      title: '文件',
      key: 'file',
      render: (_, record) => (
        <Space>
          {getFileIcon(record.file_type)}
          <Text ellipsis style={{ maxWidth: 200 }}>{record.file_name}</Text>
        </Space>
      )
    },
    {
      title: '关联类型',
      dataIndex: 'entity_type',
      key: 'entity_type',
      width: 120,
      render: (type) => {
        const info = ENTITY_TYPE_MAP[type];
        return info ? <Tag color={info.color}>{info.text}</Tag> : type;
      }
    },
    {
      title: '关联ID',
      dataIndex: 'entity_id',
      key: 'entity_id',
      width: 80
    },
    {
      title: '文件大小',
      dataIndex: 'file_size',
      key: 'file_size',
      width: 100,
      render: (size) => formatFileSize(size)
    },
    {
      title: '上传人',
      dataIndex: 'uploader_name',
      key: 'uploader_name',
      width: 100
    },
    {
      title: '上传时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (text) => text ? dayjs(text).format('YYYY-MM-DD HH:mm') : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="下载"><Button type="link" size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(record)} /></Tooltip>
          <Tooltip title="详情"><Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)} /></Tooltip>
          <Popconfirm title="确定删除此附件？" onConfirm={() => handleDelete(record.id)}>
            <Tooltip title="删除"><Button type="link" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      {stats && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card><Statistic title="附件总数" value={stats.total_count || 0} prefix={<FileTextOutlined />} /></Card>
          </Col>
          <Col span={6}>
            <Card><Statistic title="总大小" value={stats.total_size || 0} formatter={(v) => formatFileSize(v)} prefix={<CloudUploadOutlined />} /></Card>
          </Col>
          <Col span={6}>
            <Card><Statistic title="今日上传" value={stats.today_count || 0} /></Card>
          </Col>
          <Col span={6}>
            <Card><Statistic title="文件类型" value={stats.file_types || 0} /></Card>
          </Col>
        </Row>
      )}

      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Space wrap>
            <Select
              placeholder="关联类型"
              allowClear
              style={{ width: 160 }}
              value={filters.entity_type || undefined}
              onChange={(val) => setFilters({ ...filters, entity_type: val || '' })}
            >
              {Object.entries(ENTITY_TYPE_MAP).map(([k, v]) => (
                <Option key={k} value={k}>{v.text}</Option>
              ))}
            </Select>
            <Upload {...uploadProps} showUploadList={false}>
              <Button type="primary" icon={<UploadOutlined />}>上传附件</Button>
            </Upload>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={attachments}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 个附件`
          }}
          onChange={(p) => setPagination({ ...pagination, current: p.current, pageSize: p.pageSize })}
        />
      </Card>

      <Modal
        title="附件详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="download" icon={<DownloadOutlined />} onClick={() => currentDetail && handleDownload(currentDetail)}>下载</Button>,
          <Button key="close" onClick={() => setDetailVisible(false)}>关闭</Button>
        ]}
      >
        {currentDetail && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="文件名">{currentDetail.file_name}</Descriptions.Item>
            <Descriptions.Item label="文件大小">{formatFileSize(currentDetail.file_size)}</Descriptions.Item>
            <Descriptions.Item label="文件类型">{currentDetail.file_type || '-'}</Descriptions.Item>
            <Descriptions.Item label="存储路径">{currentDetail.file_path}</Descriptions.Item>
            <Descriptions.Item label="关联类型">
              <Tag color={ENTITY_TYPE_MAP[currentDetail.entity_type]?.color}>
                {ENTITY_TYPE_MAP[currentDetail.entity_type]?.text || currentDetail.entity_type}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="关联ID">{currentDetail.entity_id}</Descriptions.Item>
            <Descriptions.Item label="上传人">{currentDetail.uploader_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="上传时间">
              {currentDetail.created_at ? dayjs(currentDetail.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default Attachments;
