import React, { useEffect, useState } from 'react';
import { getInstances, getA2Rpt, exportA2RptExcel, getInstanceList, getInstanceStatus } from './api';
import {
  Container, Typography, Box, FormControl, InputLabel, Select, MenuItem, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Pagination, CircularProgress
} from '@mui/material';
// เพิ่มไอคอน
import CircleIcon from '@mui/icons-material/Circle';

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

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>ระบบตรวจสอบสถานะฐานข้อมูลและสร้างรายงาน</Typography>
      <Box display="flex" gap={2} alignItems="center" mb={2}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>เลือกเครื่อง</InputLabel>
          <Select
            value={selected}
            label="เลือกเครื่อง"
            onChange={e => { setSelected(e.target.value); setPage(1); }}
          >
            {instances.map(i => {
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
                      <CircleIcon fontSize="small" sx={{ color: online ? 'green' : 'gray', mr: 1 }} />
                      {i.name} {online ? '' : '(ออฟไลน์)'}
                    </span>
                  )}
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel>เดือน</InputLabel>
          <Select value={month} label="เดือน" onChange={e => { setMonth(Number(e.target.value)); setPage(1); }}>
            {months.map(m => (
              <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 120 }}>
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
          disabled={!selected || !year || !month}
          onClick={() => exportA2RptExcel({ name: selected, year, month })}
        >
          Export Excel
        </Button>
        <Button
          variant="outlined"
          href={pdfUrl}
          target="_blank"
          disabled={!selected}
        >
          เปิด PDF รายงาน
        </Button>
      </Box>
      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ mb: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
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
              {data.map((row, idx) => (
                <TableRow key={idx}>
                  <TableCell>{row.rmd_date ? row.rmd_date.split('T')[0] : ''}</TableCell>
                  <TableCell>{row.hn}</TableCell>
                  <TableCell>{row.rmd_qty2}</TableCell>
                  <TableCell>{row.rmd_size}</TableCell>
                  <TableCell>{row.rmd_length}</TableCell>
                  <TableCell>{row.rmd_qty3}</TableCell>
                  <TableCell>{row.rmd_qa_grade}</TableCell>
                  <TableCell>{row.rmd_weight}</TableCell>
                  <TableCell>{row.rmd_remark}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Box display="flex" justifyContent="center" mb={4}>
        <Pagination
          count={Math.ceil(total / pageSize)}
          page={page}
          onChange={(_, value) => setPage(value)}
          color="primary"
        />
      </Box>
    </Container>
  );
}

export default App; 