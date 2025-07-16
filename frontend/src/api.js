import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE || '/api';

export async function getInstances() {
  const res = await axios.get(`${API_BASE}/instances`);
  return res.data;
}

export async function getA2Rpt({ name, year, month, page = 1, pageSize = 20 }) {
  const res = await axios.get(`${API_BASE}/a2rpt`, {
    params: { name, year, month, page, pageSize }
  });
  return res.data.data;
}

export function exportA2RptExcel({ name, year, month }) {
  const url = `${API_BASE}/a2rpt/export?name=${encodeURIComponent(name)}&year=${year}&month=${month}`;
  window.open(url, '_blank');
}

export async function getInstanceList() {
  const res = await axios.get(`${API_BASE}/instances/list`);
  return res.data;
}

export async function getInstanceStatus(name) {
  const res = await axios.get(`${API_BASE}/instances/status`, { params: { name } });
  return res.data;
} 