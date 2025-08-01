import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE || '/api'; //production
//const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:4001/api'; // เปลี่ยนจาก 4000 เป็น 4001

export async function getInstances() {
  const res = await axios.get(`${API_BASE}/instances/list`);
  return res.data;
}

export async function getA2Rpt({ name, year, month, page = 1, pageSize = 20 }) {
  const res = await axios.get(`${API_BASE}/a2rpt`, {
    params: { name, year, month, page, pageSize }
  });
  return res.data.data;
}

export async function exportA2RptExcel({ name, year, month }) {
  try {
    const response = await axios.get(`${API_BASE}/a2rpt/export`, {
      params: { name, year, month },
      responseType: 'blob'
    });
    
    // ตรวจสอบว่า response เป็น Excel file หรือ error JSON
    const contentType = response.headers['content-type'];
    if (contentType && contentType.includes('application/json')) {
      // ถ้าเป็น JSON แสดงว่าเป็น error response
      const errorText = await response.data.text();
      const errorData = JSON.parse(errorText);
      throw new Error(errorData.error || errorData.detail || 'เกิดข้อผิดพลาดในการ export Excel');
    }
    
    // สร้าง blob URL สำหรับดาวน์โหลด
    const blob = new Blob([response.data], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    const url = window.URL.createObjectURL(blob);
    
    // สร้าง link element และคลิกเพื่อดาวน์โหลด
    const link = document.createElement('a');
    link.href = url;
    link.download = `a2rpt_${name}_${year}-${month.toString().padStart(2, '0')}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // ลบ blob URL
    window.URL.revokeObjectURL(url);
    
    return { success: true };
  } catch (error) {
    console.error('Export error:', error);
    
    // ถ้าเป็น error response ที่มี JSON
    if (error.response && error.response.data) {
      try {
        const errorText = await error.response.data.text();
        const errorData = JSON.parse(errorText);
        throw new Error(errorData.error || errorData.detail || 'เกิดข้อผิดพลาดในการ export Excel');
      } catch (parseError) {
        throw new Error('เกิดข้อผิดพลาดในการ export Excel');
      }
    }
    
    throw new Error('เกิดข้อผิดพลาดในการ export Excel');
  }
}

export async function getInstanceList() {
  const res = await axios.get(`${API_BASE}/instances/list`);
  return res.data;
}

export async function getInstanceStatus(name) {
  const res = await axios.get(`${API_BASE}/instances/status`, { params: { name } });
  return res.data;
} 