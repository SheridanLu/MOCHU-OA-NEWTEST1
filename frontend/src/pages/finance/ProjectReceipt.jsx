import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  message,
  Popconfirm,
  Card,
  Tag,
  Row,
  Col,
  Statistic,
  Tooltip
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  DollarOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

const ProjectReceipt = () => {
  const [form] = Form.useForm();
  const [receipts, setReceipts] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [searchParams, setSearchParams] = useState({});
  const [summary, setSummary] = useState({ receipt_count: 0, total_receipt_amount: 0, total_invoice_amount: 0 });

  const fetchProjects = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/projects', {
        params: { pageSize: 1000 },
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) setProjects(response.data.data || []);
    } catch (error) {
      console.error('获取项目列表失败:', error);
    }
  }, []);

  const fetchReceipts = useCallback(async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/receipts', {
        params: { page, pageSize, ...searchParams },
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setReceipts(response.data.data || []);
        setPagination(prev => ({ ...prev, current: page, pageSize, total: response.data.pagination?.total || 0 }));
      }
    } catch (error) {
      console.error('获取收款登记列表失败:', error);
      message.error('获取收款登记列表失败');
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  const fetchSummary = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/receipts', {
        params: { pageSize: 1000 },
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        const data = response.data.data || [];
        setSummary({
          receipt_count: data.length,
          total_receipt_amount: data.reduce((sum, r) => sum + (r.receipt_amount || 0), 0),
          total_invoice_amount: data.reduce((sum, r) => sum + (r.invoice_amount || 0), 0)
        });
      }
    } catch (error) {
      console.error('获取汇总数据失败:', error);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
    fetchReceipts();
    fetchSummary();
  }, [fetchProjects, fetchReceipts, fetchSummary]);

  const handleOpenModal = (receipt = null) => {
    setEditingReceipt(receipt);
    if (receipt) {
      form.setFieldsValue({ ...receipt, receipt_date: receipt.receipt_date ? dayjs(receipt.receipt_date) : null });
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setEditingReceipt(null);
    form.resetFields();
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const submitData = { ...values, receipt_date: values.receipt_date ? values.receipt_date.format('YYYY-MM-DD') : null };

      if (editingReceipt) {
        const response = await axios.put(`/api/receipts/${editingReceipt.id}`, submitData, { headers });
        if (response.data.success) {
          message.success('更新成功');
          handleCloseModal();
          fetchReceipts(pagination.current, pagination.pageSize);
          fetchSummary();
        } else {
          message.error(response.data.message || '更新失败');
        }
      } else {
        const response = await axios.post('/api/receipts', submitData, { headers });
        if (response.data.success) {
          message.success('新增成功');
          handleCloseModal();
          fetchReceipts(pagination.current, pagination.pageSize);
          fetchSummary();
        } else {
          message.error(response.data.message || '新增失败');
        }
      }
    } catch (error) {
      console.error('提交失败:', error);
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete(`/api/receipts/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (response.data.success) {
        message.success('删除成功');
        fetchReceipts(pagination.current, pagination.pageSize);
        fetchSummary();
      } else {
        message.error(response.data.message || '删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  const columns = [
    { title: '收款编号', dataIndex: 'receipt_no', key: 'receipt_no', width: 160 },
    { title: '项目编号', dataIndex: 'project_no', key: 'project_no', width: 120 },
    { title: '项目名称', dataIndex: 'project_name', key: 'project_name', width: 200, ellipsis: true },
    { title: '发票号码', dataIndex: 'invoice_number', key: 'invoice_number', width: 150 },
    { title: '发票金额', dataIndex: 'invoice_amount', key: 'invoice_amount', width: 120, align: 'right', render: (val) => val ? `¥${Number(val).toLocaleString()}` : '-' },
    { title: '收款金额', dataIndex: 'receipt_amount', key: 'receipt_amount', width: 120, align: 'right', render: (val) => `¥${Number(val).toLocaleString()}` },
    { title: '收款日期', dataIndex: 'receipt_date', key: 'receipt_date', width: 120 },
    { title: '收款方式', dataIndex: 'payment_method', key: 'payment_method', width: 100, render: (val) => ({ 'bank': '银行转账', 'cash': '现金', 'check': '支票', 'other': '其他' }[val] || val || '-') },
    { title: '付款人', dataIndex: 'payer_name', key: 'payer_name', width: 120, ellipsis: true },
    { title: '登记人', dataIndex: 'creator_name', key: 'creator_name', width: 100 },
    {
      title: '操作', key: 'action', width: 100, fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="编辑"><Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleOpenModal(record)} /></Tooltip>
          <Popconfirm title="确定要删除此收款登记吗？" onConfirm={() => handleDelete(record.id)} okText="确定" cancelText="取消">
            <Tooltip title="删除"><Button type="link" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}><Card><Statistic title="收款笔数" value={summary.receipt_count} suffix="笔" prefix={<FileTextOutlined />} /></Card></Col>
        <Col span={6}><Card><Statistic title="累计发票金额" value={summary.total_invoice_amount} precision={2} prefix="¥" valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="累计收款金额" value={summary.total_receipt_amount} precision={2} prefix="¥" valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="未开票金额" value={summary.total_receipt_amount - summary.total_invoice_amount} precision={2} prefix="¥" valueStyle={{ color: summary.total_receipt_amount - summary.total_invoice_amount >= 0 ? '#faad14' : '#52c41a' }} /></Card></Col>
      </Row>

      <Card title="项目收款登记" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>新增收款登记</Button>}>
        <div style={{ marginBottom: 16 }}>
          <Space wrap>
            <Select placeholder="选择项目" allowClear style={{ width: 200 }} onChange={(val) => setSearchParams(prev => ({ ...prev, project_id: val }))}>
              {projects.map(p => <Option key={p.id} value={p.id}>{p.project_no} - {p.name}</Option>)}
            </Select>
            <RangePicker placeholder={['开始日期', '结束日期']} onChange={(dates) => {
              if (dates) setSearchParams(prev => ({ ...prev, start_date: dates[0].format('YYYY-MM-DD'), end_date: dates[1].format('YYYY-MM-DD') }));
              else setSearchParams(prev => { const { start_date, end_date, ...rest } = prev; return rest; });
            }} />
            <Input placeholder="搜索发票号/项目名称" style={{ width: 200 }} onPressEnter={(e) => setSearchParams(prev => ({ ...prev, keyword: e.target.value }))} />
            <Button type="primary" icon={<SearchOutlined />} onClick={() => fetchReceipts(1, pagination.pageSize)}>搜索</Button>
          </Space>
        </div>
        <Table columns={columns} dataSource={receipts} rowKey="id" loading={loading} pagination={{ ...pagination, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }} onChange={(pag) => fetchReceipts(pag.current, pag.pageSize)} scroll={{ x: 1300 }} />
      </Card>

      <Modal title={editingReceipt ? '编辑收款登记' : '新增收款登记'} open={modalVisible} onCancel={handleCloseModal} onOk={handleSubmit} width={600} destroyOnClose>
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="project_id" label="项目" rules={[{ required: true, message: '请选择项目' }]}>
            <Select placeholder="请选择项目" showSearch optionFilterProp="children" filterOption={(input, option) => option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0}>
              {projects.map(p => <Option key={p.id} value={p.id}>{p.project_no} - {p.name}</Option>)}
            </Select>
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="invoice_number" label="发票号码"><Input placeholder="请输入发票号码" /></Form.Item></Col>
            <Col span={12}><Form.Item name="invoice_amount" label="发票金额"><InputNumber style={{ width: '100%' }} placeholder="请输入发票金额" min={0} precision={2} prefix="¥" /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="receipt_amount" label="收款金额" rules={[{ required: true, message: '请输入收款金额' }]}><InputNumber style={{ width: '100%' }} placeholder="请输入收款金额" min={0.01} precision={2} prefix="¥" /></Form.Item></Col>
            <Col span={12}><Form.Item name="receipt_date" label="收款日期" rules={[{ required: true, message: '请选择收款日期' }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="payment_method" label="收款方式"><Select placeholder="请选择收款方式"><Option value="bank">银行转账</Option><Option value="cash">现金</Option><Option value="check">支票</Option><Option value="other">其他</Option></Select></Form.Item></Col>
            <Col span={12}><Form.Item name="payer_name" label="付款人"><Input placeholder="请输入付款人名称" /></Form.Item></Col>
          </Row>
          <Form.Item name="bank_account" label="银行账号"><Input placeholder="请输入银行账号" /></Form.Item>
          <Form.Item name="remarks" label="备注"><Input.TextArea rows={3} placeholder="请输入备注信息" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProjectReceipt;
