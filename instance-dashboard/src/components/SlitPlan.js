import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  IconButton,
  CircularProgress,
  Alert,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import { getApiUrl } from '../config';

const SlitPlan = ({ machine, onClose }) => {
  const [chargeInput, setChargeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [rmList, setRmList] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [insertedItems, setInsertedItems] = useState([]);

  // Pagination
  const [page, setPage] = useState(0); // 0-based
  const [rowsPerPage, setRowsPerPage] = useState(10); // เปลี่ยนจาก 20 เป็น 10
  const [total, setTotal] = useState(0);

  // ดึงข้อมูล RM List เมื่อ component mount
  useEffect(() => {
    if (machine) {
      fetchRmList();
    }
  }, [machine, statusFilter, page, rowsPerPage]);

  const fetchRmList = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${getApiUrl('/api/rm-list')}?machine=${encodeURIComponent(machine)}&status=${statusFilter}&page=${page + 1}&pageSize=${rowsPerPage}`
      );
      const payload = Array.isArray(response.data)
        ? { data: response.data, total: response.data.length }
        : response.data;
      setRmList(payload.data || []);
      setTotal(payload.total || (payload.data || []).length || 0);
    } catch (error) {
      console.error('Error fetching RM list:', error);
      setMessage({ type: 'error', text: 'ไม่สามารถดึงข้อมูล RM List ได้' });
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSlit = async () => {
    if (!chargeInput.trim()) {
      setMessage({ type: 'error', text: 'กรุณากรอกเลข Charge' });
      return;
    }

    try {
      setLoading(true);
      setMessage({ type: '', text: '' });

      // เพิ่ม 'S' นำหน้าเลข Charge ที่ผู้ใช้กรอก
      const fullChargeNumber = `S${chargeInput.trim()}`;

      // 1) ค้นหาข้อมูลใน production scale
      const response = await axios.get(
        `${getApiUrl('/api/slit-plan/search')}?charge=${encodeURIComponent(fullChargeNumber)}`
      );
      if (!response.data || response.data.length === 0) {
        setMessage({ type: 'warning', text: 'ไม่มีข้อมูล slit สำหรับ Charge นี้' });
        return;
      }

      // 2) เช็คว่ามีในเครื่องปลายทางหรือยัง
      const checkResponse = await axios.get(
        `${getApiUrl('/api/rm-list/check')}?machine=${encodeURIComponent(machine)}&charge=${encodeURIComponent(fullChargeNumber)}`
      );
      if (checkResponse.data?.exists) {
        setMessage({ type: 'warning', text: `Charge ${fullChargeNumber} เคยถูกเพิ่มลงในระบบแล้ว` });
        return;
      }

      // 3) Insert ลง tbl_rm_list
      const insertPromises = response.data.map((item) => {
        const last4 = item.rmd_mat?.slice(-4) || '0000';
        const size = (parseInt(last4, 10) / 10).toFixed(1);

        return axios.post(
          `${getApiUrl('/api/rm-list')}?machine=${encodeURIComponent(machine)}`,
          {
            matnr: item.rmd_mat,
            batch: item.rmd_charge,
            width: size,
            sloc: 'SLIT',
            weight: item.rmd_weight,
            qty: item.rmd_weight,
            unit: 'KG',
            rm_status: 'A',
          }
        );
      });

      const insertResults = await Promise.all(insertPromises);
      const insertedData = insertResults.map((r) => r.data);

      setInsertedItems(insertedData);
      setMessage({ type: 'success', text: `เพิ่มข้อมูล ${insertedData.length} รายการสำเร็จ` });

      // refresh RM list
      await fetchRmList();
    } catch (error) {
      console.error('Error processing slit plan:', error);
      setMessage({ type: 'error', text: error.response?.data?.error || 'เกิดข้อผิดพลาดในการประมวลผล' });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'A': return 'success';
      case 'C': return 'warning';
      default: return 'default';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'A': return 'Active';
      case 'C': return 'Completed';
      default: return status;
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ 
        p: 3, 
        borderBottom: 1, 
        borderColor: 'divider',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        bgcolor: 'primary.main',
        color: 'white'
      }}>
        <Typography variant="h5" fontWeight={600}>
          แผนสลิท - {machine}
        </Typography>
        <IconButton onClick={onClose} sx={{ color: 'white' }}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ p: 3, flex: 1, overflow: 'auto' }}>
        {/* Search Section */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            ค้นหาข้อมูล Slit
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
            <TextField
              label="เลข Charge"
              value={chargeInput}
              onChange={(e) => setChargeInput(e.target.value)}
              placeholder="กรอกเลข Charge"
              size="small"
              sx={{ flex: 1 }}
              onKeyPress={(e) => e.key === 'Enter' && handleSearchSlit()}
            />
            <Button
              variant="contained"
              onClick={handleSearchSlit}
              size="small"
              disabled={loading || !chargeInput.trim()}
              startIcon={loading ? <CircularProgress size={20} /> : <SearchIcon />}
            >
              เพิ่ม
            </Button>
          </Box>
          
          {message.text && (
            <Alert severity={message.type} sx={{ mt: 2 }}>
              {message.text}
            </Alert>
          )}
        </Paper>

        {/* Filter Section */}
        <Box sx={{ mb: 3 }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>สถานะ</InputLabel>
            <Select
              value={statusFilter}
              label="สถานะ"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="all">ทั้งหมด</MenuItem>
              <MenuItem value="A">Active</MenuItem>
              <MenuItem value="C">Completed</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* RM List Table */}
        <Paper sx={{ width: '100%' }}>
          <TableContainer sx={{ maxHeight: 400 }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Material</TableCell>
                  <TableCell>Batch</TableCell>
                  <TableCell>Width</TableCell>
                  <TableCell>Storage Location</TableCell>
                  <TableCell>Weight</TableCell>
                  <TableCell>Qty</TableCell>
                  <TableCell>Unit</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : rmList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      ไม่มีข้อมูล
                    </TableCell>
                  </TableRow>
                ) : (
                  rmList.map((item, index) => (
                    <TableRow 
                      key={index}
                      sx={{ 
                        bgcolor: insertedItems.some(inserted => 
                          inserted.matnr === item.matnr && 
                          inserted.batch === item.batch
                        ) ? 'success.light' : 'inherit'
                      }}
                    >
                      <TableCell>{item.matnr}</TableCell>
                      <TableCell>{item.batch}</TableCell>
                      <TableCell>{item.width}</TableCell>
                      <TableCell>{item.sloc}</TableCell>
                      <TableCell>{item.weight}</TableCell>
                      <TableCell>{item.qty}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell>
                        <Chip 
                          label={getStatusText(item.rm_status)} 
                          color={getStatusColor(item.rm_status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        {String(item.rm_status).toUpperCase() !== 'C' && (
                          <IconButton
                            aria-label="delete"
                            color="error"
                            size="small"
                            onClick={async () => {
                              if (!window.confirm(`ยืนยันลบ Batch ${item.batch}?`)) return;
                              try {
                                setLoading(true);
                                await axios.delete(
                                  `${getApiUrl('/api/rm-list')}/${encodeURIComponent(item.batch)}?machine=${encodeURIComponent(machine)}`
                                );
                                await fetchRmList();
                                setMessage({ type: 'success', text: `ลบ ${item.batch} สำเร็จ` });
                              } catch (e) {
                                console.error('Delete error:', e);
                                setMessage({ type: 'error', text: 'ลบไม่สำเร็จ' });
                              } finally {
                                setLoading(false);
                              }
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[10, 20, 50, 100, 200]}
          />
        </Paper>
      </Box>
    </Box>
  );
};

export default SlitPlan;