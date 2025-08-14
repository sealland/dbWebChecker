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

        // ตรวจสอบ 2 หลักแรกของ fullChargeNumber เพื่อกำหนด sloc
        const firstTwoChars = fullChargeNumber.substring(0, 2);
        let sloc;
        if (firstTwoChars === 'S1') {
          sloc = '2103';
        } else {
          sloc = '2106';
        }

        return axios.post(
          `${getApiUrl('/api/rm-list')}?machine=${encodeURIComponent(machine)}`,
          {
            matnr: item.rmd_mat,
            batch: item.rmd_charge,
            width: size,
            sloc: sloc,
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

      // Reset pagination to first page and refresh RM list
      setPage(0);
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
    <Box sx={{ 
      height: '75vh', // ลดจาก 100vh เป็น 75vh (ลดลง 25%)
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <Box sx={{ 
        p: { xs: 1, sm: 1, md: 2 }, 
        borderBottom: 1, 
        borderColor: 'divider',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        bgcolor: 'primary.main',
        color: 'white',
        flexShrink: 0
      }}>
        <Typography variant="h6" fontWeight={600} >
          แผนสลิท - {machine}
        </Typography>
        <IconButton onClick={onClose} sx={{ color: 'white' }} size="small">
          <CloseIcon fontSize="small"/>
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ 
        p: { xs: 0.5, sm: 0.5, md: 1 }, 
        flex: 1, 
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Search Section */}
        <Paper sx={{ p: { xs: 0.5, sm: 1 }, mb: 1, flexShrink: 0 }}>
          <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: '1rem', sm: '1.1rem', md: '1.25rem' } }}>
            ค้นหาข้อมูล Slit
          </Typography>
          <Box sx={{ 
            display: 'flex', 
            gap: 1, 
            alignItems: 'center', 
            mb: 1,
            flexDirection: { xs: 'column', sm: 'row' }
          }}>
            <TextField
              label="เลข Charge"
              value={chargeInput}
              onChange={(e) => setChargeInput(e.target.value)}
              placeholder="กรอกเลข Charge"
              size="small"
              sx={{ flex: 1, minWidth: { xs: '100%', sm: 'auto' } }}
              onKeyPress={(e) => e.key === 'Enter' && handleSearchSlit()}
            />
            <Button
              variant="contained"
              onClick={handleSearchSlit}
              size="small"
              disabled={loading || !chargeInput.trim()}
              startIcon={loading ? <CircularProgress size={20} /> : <SearchIcon />}
              sx={{ minWidth: { xs: '100%', sm: 'auto' } }}
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
        <Box sx={{ 
          mb: 2, 
          flexShrink: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2
        }}>
          <FormControl sx={{ minWidth: { xs: '100%', sm: 150 } }} size="small">
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
          
          {/* Pagination moved to top right */}
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[10, 20, 50, 100, 200]}
            sx={{ 
              flexShrink: 0,
              '& .MuiTablePagination-toolbar': {
                padding: 0,
                minHeight: 'auto'
              },
              '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                margin: 0
              }
            }}
          />
        </Box>

        {/* RM List Table */}
        <Paper sx={{ 
          width: '100%', 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          minHeight: 0
        }}>
          <Box sx={{
            flex: 1,
            overflow: 'auto',
            overflowX: 'auto',
            minHeight: 0,
            '&::-webkit-scrollbar': {
              height: '8px'
            },
            '&::-webkit-scrollbar-track': {
              background: '#f1f1f1'
            },
            '&::-webkit-scrollbar-thumb': {
              background: '#888',
              borderRadius: '4px'
            },
            '&::-webkit-scrollbar-thumb:hover': {
              background: '#555'
            }
          }}>
            <TableContainer sx={{ 
              '& .MuiTable-root': {
                minWidth: 1000, // เพิ่มความกว้างขั้นต่ำให้มากขึ้น
                width: 'max-content' // ให้ table ขยายตามเนื้อหา
              }
            }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ minWidth: 150, whiteSpace: 'nowrap' }}>Material</TableCell>
                    <TableCell sx={{ minWidth: 150, whiteSpace: 'nowrap' }}>Batch</TableCell>
                    <TableCell sx={{ minWidth: 100, whiteSpace: 'nowrap' }}>Width</TableCell>
                    <TableCell sx={{ minWidth: 150, whiteSpace: 'nowrap' }}>Storage Location</TableCell>
                    <TableCell sx={{ minWidth: 120, whiteSpace: 'nowrap' }}>Weight</TableCell>
                    <TableCell sx={{ minWidth: 100, whiteSpace: 'nowrap' }}>Qty</TableCell>
                    <TableCell sx={{ minWidth: 80, whiteSpace: 'nowrap' }}>Unit</TableCell>
                    <TableCell sx={{ minWidth: 120, whiteSpace: 'nowrap' }}>Status</TableCell>
                    <TableCell align="right" sx={{ minWidth: 100, whiteSpace: 'nowrap' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center">
                        <CircularProgress />
                      </TableCell>
                    </TableRow>
                  ) : rmList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center">
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
                        <TableCell sx={{ minWidth: 150, whiteSpace: 'nowrap' }}>{item.matnr}</TableCell>
                        <TableCell sx={{ minWidth: 150, whiteSpace: 'nowrap' }}>{item.batch}</TableCell>
                        <TableCell sx={{ minWidth: 100, whiteSpace: 'nowrap' }}>{item.width}</TableCell>
                        <TableCell sx={{ minWidth: 150, whiteSpace: 'nowrap' }}>{item.sloc}</TableCell>
                        <TableCell sx={{ minWidth: 120, whiteSpace: 'nowrap' }}>{item.weight}</TableCell>
                        <TableCell sx={{ minWidth: 100, whiteSpace: 'nowrap' }}>{item.qty}</TableCell>
                        <TableCell sx={{ minWidth: 80, whiteSpace: 'nowrap' }}>{item.unit}</TableCell>
                        <TableCell sx={{ minWidth: 120, whiteSpace: 'nowrap' }}>
                          <Chip 
                            label={getStatusText(item.rm_status)} 
                            color={getStatusColor(item.rm_status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ minWidth: 100, whiteSpace: 'nowrap' }}>
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
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

export default SlitPlan;