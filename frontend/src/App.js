import React, { useEffect, useState } from 'react';
import { getInstances, getA2Rpt, exportA2RptExcel, getInstanceList, getInstanceStatus } from './api';
import {
  Container, Typography, Box, FormControl, InputLabel, Select, MenuItem, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Pagination, CircularProgress, Card, CardContent, Snackbar, Alert, Skeleton
} from '@mui/material';
// เพิ่มไอคอน
import CircleIcon from '@mui/icons-material/Circle';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';

const months = [
  { value: 1, label: 'มกราคม' }, { value: 2, label: 'กุมภาพันธ์' }, { value: 3, label: 'มีนาคม' },
  { value: 4, label: 'เมษายน' }, { value: 5, label: 'พฤษภาคม' }, { value: 6, label: 'มิถุนายน' },
  { value: 7, label: 'กรกฎาคม' }, { value: 8, label: 'สิงหาคม' }, { value: 9, label: 'กันยายน' },
  { value: 10, label: 'ตุลาคม' }, { value: 11, label: 'พฤศจิกายน' }, { value: 12, label: 'ธันวาคม' }
];

function App() {
  const [instances, setInstances] = useState([]);
  const [statusMap, setStatusMap] = useState({}); // { name: true/false }
  const [statusLoading, setStatusLoading] = useState({}); // { name: true/false }
  const [selected, setSelected] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    // โหลดรายชื่อเครื่องทันที
    getInstanceList().then(list => {
      setInstances(list);
      // เริ่มเช็คสถานะทีละเครื่องแบบ async
      list.forEach(i => {
        setStatusLoading(prev => ({ ...prev, [i.name]: true }));
        getInstanceStatus(i.name)
          .then(res => setStatusMap(prev => ({ ...prev, [i.name]: res.online })))
          .catch(() => setStatusMap(prev => ({ ...prev, [i.name]: false })))
          .finally(() => setStatusLoading(prev => ({ ...prev, [i.name]: false })));
      });
    });
  }, []);

  useEffect(() => {
    if (selected && year && month) {
      setLoading(true);
      getA2Rpt({ name: selected, year, month, page, pageSize })
        .then(d => {
          setData(d);
          setLoading(false);
          setTotal(d.length < pageSize && page === 1 ? d.length : 100); // สมมุติ total ถ้ายังไม่ได้ implement total จริง
        })
        .catch(() => setLoading(false));
    } else {
      setData([]);
    }
  }, [selected, year, month, page, pageSize]);

  const selectedInstance = instances.find(i => i.name === selected);
  const pdfUrl = selectedInstance ? `http://report.zubbsteel.com/ocp/tcpdf/pdf/rpt_a2.php?ref=${year}-${month.toString().padStart(2, '0')}&m=${selectedInstance.m}` : '#';

  const handleExport = async () => {
    try {
      exportA2RptExcel({ name: selected, year, month });
      setSnackbar({ open: true, message: 'กำลังดาวน์โหลดไฟล์ Excel...', severity: 'info' });
    } catch (e) {
      setSnackbar({ open: true, message: 'Export ล้มเหลว', severity: 'error' });
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f4f6fa', py: 4 }}>
      <Container maxWidth="lg">
        <Card sx={{ boxShadow: 3, borderRadius: 3 }}>
          <CardContent>
            <Typography variant="h4" fontWeight={700} color="primary.main" align="center" gutterBottom>
              ตรวจสอบสถานะฐานข้อมูลและสร้างรายงาน
            </Typography>
            <Box display="flex" gap={2} alignItems="center" mb={3} flexWrap="wrap" justifyContent="center">
              <FormControl sx={{ minWidth: 220 }} size="small">
                <InputLabel>เลือกเครื่อง</InputLabel>
                <Select
                  value={selected}
                  label="เลือกเครื่อง"
                  onChange={e => { setSelected(e.target.value); setPage(1); }}
                  MenuProps={{ PaperProps: { sx: { maxHeight: 300 } } }}
                >
                  {instances.length === 0 ? (
                    <MenuItem disabled>กำลังโหลด...</MenuItem>
                  ) : (
                    instances.map(i => {
                      const online = statusMap[i.name];
                      const loading = statusLoading[i.name];
                      return (
                        <MenuItem key={i.name} value={i.name} disabled={loading ? true : online === false}>
                          {loading ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                              <CircleIcon fontSize="small" sx={{ color: 'gray', mr: 1 }} />
                              {i.name} (กำลังเช็ค...)
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                              <CircleIcon fontSize="small" sx={{ color: online ? '#2e7d32' : '#bdbdbd', mr: 1 }} />
                              {i.name} {online ? '' : '(ออฟไลน์)'}
                            </span>
                          )}
                        </MenuItem>
                      );
                    })
                  )}
                </Select>
              </FormControl>
              <FormControl sx={{ minWidth: 120 }} size="small">
                <InputLabel>เดือน</InputLabel>
                <Select value={month} label="เดือน" onChange={e => { setMonth(Number(e.target.value)); setPage(1); }}>
                  {[
                    { value: 1, label: 'มกราคม' }, { value: 2, label: 'กุมภาพันธ์' }, { value: 3, label: 'มีนาคม' },
                    { value: 4, label: 'เมษายน' }, { value: 5, label: 'พฤษภาคม' }, { value: 6, label: 'มิถุนายน' },
                    { value: 7, label: 'กรกฎาคม' }, { value: 8, label: 'สิงหาคม' }, { value: 9, label: 'กันยายน' },
                    { value: 10, label: 'ตุลาคม' }, { value: 11, label: 'พฤศจิกายน' }, { value: 12, label: 'ธันวาคม' }
                  ].map(m => (
                    <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl sx={{ minWidth: 120 }} size="small">
                <InputLabel>ปี</InputLabel>
                <Select value={year} label="ปี" onChange={e => { setYear(Number(e.target.value)); setPage(1); }}>
                  {[...Array(5)].map((_, idx) => {
                    const y = new Date().getFullYear() - idx;
                    return <MenuItem key={y} value={y}>{y + 543}</MenuItem>;
                  })}
                </Select>
              </FormControl>
              <Button
                variant="contained"
                color="primary"
                size="medium"
                startIcon={<CloudDownloadIcon />}
                disabled={!selected || !year || !month}
                onClick={handleExport}
                sx={{ minWidth: 140, fontWeight: 600 }}
              >
                Export Excel
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                size="medium"
                startIcon={<PictureAsPdfIcon />}
                href={pdfUrl}
                target="_blank"
                disabled={!selected}
                sx={{ minWidth: 140, fontWeight: 600 }}
              >
                เปิด PDF รายงาน
              </Button>
            </Box>
            {loading ? (
              <Box display="flex" flexDirection="column" alignItems="center" minHeight={200}>
                <Skeleton variant="rectangular" width="100%" height={40} sx={{ mb: 1, borderRadius: 1 }} />
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} variant="rectangular" width="100%" height={32} sx={{ mb: 0.5, borderRadius: 1 }} />
                ))}
              </Box>
            ) : (
              <TableContainer component={Paper} sx={{ mb: 2, borderRadius: 2, boxShadow: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#e3f2fd' }}>
                      <TableCell>วันที่</TableCell>
                      <TableCell>HN</TableCell>
                      <TableCell>จำนวน 2</TableCell>
                      <TableCell>ขนาด</TableCell>
                      <TableCell>ความยาว</TableCell>
                      <TableCell>จำนวน 3</TableCell>
                      <TableCell>เกรด</TableCell>
                      <TableCell>น้ำหนัก</TableCell>
                      <TableCell>หมายเหตุ</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} align="center" sx={{ color: '#bdbdbd' }}>ไม่มีข้อมูล</TableCell>
                      </TableRow>
                    ) : (
                      data.map((row, idx) => (
                        <TableRow key={idx} hover sx={{ bgcolor: idx % 2 === 0 ? '#fafbfc' : '#f4f6fa' }}>
                          <TableCell>{row.rmd_date ? (typeof row.rmd_date === 'string' ? row.rmd_date.split('T')[0] : (row.rmd_date instanceof Date ? row.rmd_date.toISOString().split('T')[0] : '')) : ''}</TableCell>
                          <TableCell>{row.hn}</TableCell>
                          <TableCell>{row.rmd_qty2}</TableCell>
                          <TableCell>{row.rmd_size}</TableCell>
                          <TableCell>{row.rmd_length}</TableCell>
                          <TableCell>{row.rmd_qty3}</TableCell>
                          <TableCell>{row.rmd_qa_grade}</TableCell>
                          <TableCell>{row.rmd_weight}</TableCell>
                          <TableCell>{row.rmd_remark}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            <Box display="flex" justifyContent="center" mb={2}>
              <Pagination
                count={Math.ceil(total / pageSize)}
                page={page}
                onChange={(_, value) => setPage(value)}
                color="primary"
              />
            </Box>
          </CardContent>
        </Card>
        <Snackbar
          open={snackbar.open}
          autoHideDuration={3000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </Box>
  );
}

export default App; 