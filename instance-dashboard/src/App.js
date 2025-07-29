import React, { useEffect, useState, useMemo, useRef } from 'react';
import axios from 'axios';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Avatar,
  Badge,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  CircularProgress,
  AppBar,
  Toolbar,
  Divider,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  TextField
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import MenuIcon from '@mui/icons-material/Menu';
import RefreshIcon from '@mui/icons-material/Refresh';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useLocation } from 'react-router-dom';

const API_URL = '/api/instances';
const REFRESH_INTERVAL = 30000; // 30 วินาที

function StatusAvatar({ online }) {
  return (
    <Badge
      overlap="circular"
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      badgeContent={
        online ? (
          <CheckCircleIcon sx={{ color: 'limegreen', fontSize: 24 }} />
        ) : (
          <CancelIcon sx={{ color: 'red', fontSize: 24 }} />
        )
      }
    >
      <Avatar sx={{ bgcolor: online ? 'success.main' : 'grey.400', width: 56, height: 56, boxShadow: 2 }}>
        <PowerSettingsNewIcon />
      </Avatar>
    </Badge>
  );
}

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function groupByCategory(instances) {
  const categories = {
    'ท่อดำ': [],
    'ตัวซี': [],
    'ตัดแผ่น': [],
    'สลิท': []
  };
  instances.forEach((item) => {
    if (item.name.startsWith('ท่อดำ')) categories['ท่อดำ'].push(item);
    else if (item.name.startsWith('ตัวซี')) categories['ตัวซี'].push(item);
    else if (item.name.startsWith('ตัดแผ่น')) categories['ตัดแผ่น'].push(item);
    else if (item.name.startsWith('สลิท')) categories['สลิท'].push(item);
  });
  return categories;
}

function App() {
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const timerRef = useRef();
  const query = useQuery();
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareDates, setCompareDates] = useState({ from: '', to: '' });
  const [stationData, setStationData] = useState([]); // ข้อมูลจาก Station
  const [planData, setPlanData] = useState([]); // ข้อมูลจาก Planning
  const [updating, setUpdating] = useState(false); // สถานะการอัพเดต
  const [loadingCompare, setLoadingCompare] = useState(false); // สถานะการโหลดข้อมูลเปรียบเทียบ

  // โหลดข้อมูล (ใช้ทั้ง auto และ manual refresh)
  const fetchInstances = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setRefreshing(true);
    try {
      const res = await axios.get(API_URL);
      setInstances(res.data);
      setLastUpdate(new Date());
    } catch {
      setInstances([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // โหลดครั้งแรก
  useEffect(() => {
    fetchInstances();
    // eslint-disable-next-line
  }, []);

  // Auto refresh ทุก 30 วินาที
  useEffect(() => {
    timerRef.current = setInterval(() => {
      fetchInstances(false);
    }, REFRESH_INTERVAL);
    return () => clearInterval(timerRef.current);
  }, []);

  // รับค่า plant จาก query string
  const plant = query.get('plant');

  // Filter เฉพาะเครื่องที่ชื่อขึ้นต้นด้วยที่กำหนด
  const filtered = useMemo(() => {
    return instances.filter(inst =>
      inst.name.startsWith('ท่อดำ') ||
      inst.name.startsWith('ตัวซี') ||
      inst.name.startsWith('ตัดแผ่น') ||
      inst.name.startsWith('สลิท')
    );
  }, [instances]);

  // Group by category
  const grouped = useMemo(() => groupByCategory(filtered), [filtered]);

  const handleCardClick = (instance) => {
    setSelected(instance);
    setDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
    setSelected(null);
  };

  // ดึงข้อมูลเปรียบเทียบจาก API
  const fetchCompareData = async () => {
    if (!compareDates.from || !compareDates.to || !selected) {
      return;
    }
    
    setLoadingCompare(true);
    try {
      // ดึงข้อมูลทั้งสองฝั่งพร้อมกัน
      const response = await axios.get('/api/compare/both', {
        params: {
          name: selected.name,
          station: selected.name, // ใช้ชื่อเครื่องเป็น station
          fromDate: compareDates.from,
          toDate: compareDates.to
        }
      });
      
      setStationData(response.data.station.data || []);
      setPlanData(response.data.planning.data || []);
    } catch (error) {
      console.error('Error fetching compare data:', error);
      setStationData([]);
      setPlanData([]);
    } finally {
      setLoadingCompare(false);
    }
  };

  // อัพเดตข้อมูล Production Plan
  const handleUpdateData = async () => {
    if (!compareDates.from || !compareDates.to || !selected) {
      return;
    }
    
    setUpdating(true);
    try {
      const response = await axios.post('/api/compare/update', {
        name: selected.name,
        station: selected.name,
        fromDate: compareDates.from,
        toDate: compareDates.to,
        shift: 'Z',
        user: 'system'
      });
      
      // รีเฟรชข้อมูลหลังจากอัพเดต
      await fetchCompareData();
      alert('อัพเดตข้อมูลสำเร็จ');
    } catch (error) {
      console.error('Error updating data:', error);
      alert('เกิดข้อผิดพลาดในการอัพเดตข้อมูล');
    } finally {
      setUpdating(false);
    }
  };

  // แปลงเวลาอัปเดตล่าสุด
  const formatTime = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Drawer เปรียบเทียบข้อมูล
  const CompareDrawer = (
    <Drawer
      anchor="right"
      open={compareOpen}
      onClose={() => setCompareOpen(false)}
      PaperProps={{ sx: { width: { xs: '100vw', sm: '90vw', md: '80vw', lg: '70vw' }, borderTopLeftRadius: 24, borderBottomLeftRadius: 24, bgcolor: '#f7fafc' } }}
    >
      <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Typography variant="h6" fontWeight={700} gutterBottom>
          เปรียบเทียบข้อมูล
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
          <TextField
            label="วันที่เริ่ม"
            type="date"
            size="small"
            value={compareDates.from}
            onChange={e => setCompareDates(d => ({ ...d, from: e.target.value }))}
            InputLabelProps={{ shrink: true }}
          />
          <Typography variant="body2">ถึง</Typography>
          <TextField
            label="วันที่สิ้นสุด"
            type="date"
            size="small"
            value={compareDates.to}
            onChange={e => setCompareDates(d => ({ ...d, to: e.target.value }))}
            InputLabelProps={{ shrink: true }}
          />
          <Button 
            variant="contained" 
            onClick={fetchCompareData} 
            disabled={loadingCompare}
            sx={{ minWidth: 64 }}
          >
            {loadingCompare ? <CircularProgress size={20} /> : 'Go'}
          </Button>
          <Button 
            variant="contained" 
            color="secondary" 
            onClick={handleUpdateData} 
            disabled={updating || stationData.length === 0}
            sx={{ minWidth: 100 }}
          >
            {updating ? <CircularProgress size={20} /> : 'อัพเดต'}
          </Button>
        </Box>
        <Box sx={{ display: 'flex', flex: 1, gap: 2, minHeight: 320 }}>
          {/* From Station */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>From Station</Typography>
            <TableContainer component={Paper} sx={{ flex: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>วันที่</TableCell>
                    <TableCell>Material</TableCell>
                    <TableCell>Size</TableCell>
                    <TableCell>Check</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loadingCompare ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        <CircularProgress size={24} />
                      </TableCell>
                    </TableRow>
                  ) : stationData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        ไม่มีข้อมูล
                      </TableCell>
                    </TableRow>
                  ) : (
                    stationData.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{row.doc_date}</TableCell>
                        <TableCell>{row.material}</TableCell>
                        <TableCell>{row.rmd_size}</TableCell>
                        <TableCell>{row['chk-a']}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
          {/* ปุ่ม >> */}
          <Box sx={{ display: 'flex', alignItems: 'center', px: 1 }}>
            <Button variant="outlined" sx={{ minWidth: 0, p: 1 }}>
              <ChevronRightIcon fontSize="large" />
            </Button>
          </Box>
          {/* From Production Plan */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>From Production Plan</Typography>
            <TableContainer component={Paper} sx={{ flex: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>วันที่</TableCell>
                    <TableCell>Material Code</TableCell>
                    <TableCell>Size</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loadingCompare ? (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
                        <CircularProgress size={24} />
                      </TableCell>
                    </TableRow>
                  ) : planData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
                        ไม่มีข้อมูล
                      </TableCell>
                    </TableRow>
                  ) : (
                    planData.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{row.postingdate}</TableCell>
                        <TableCell>{row.material_code}</TableCell>
                        <TableCell>{row.size}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Box>
      </Box>
    </Drawer>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'transparent', position: 'relative' }}>
      {/* Gradient background */}
      <Box sx={{
        position: 'fixed',
        width: '100vw',
        height: '100vh',
        zIndex: -1,
        background: 'linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%)',
      }} />
      {/* Header Bar */}
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)' }}>
        <Toolbar>
          <PowerSettingsNewIcon color="primary" sx={{ mr: 1 }} />
          <Typography variant="h5" fontWeight={700} color="primary.main" sx={{ flexGrow: 1 }}>
            Instance Status Dashboard
          </Typography>
          <Tooltip title="Refresh">
            <span>
              <IconButton color="primary" onClick={() => fetchInstances()} disabled={refreshing}>
                {refreshing ? <CircularProgress size={24} /> : <RefreshIcon />}
              </IconButton>
            </span>
          </Tooltip>
        </Toolbar>
      </AppBar>
      <Box sx={{ p: { xs: 2, sm: 4 }, maxWidth: 1400, mx: 'auto', mt: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            อัปเดตล่าสุด: {lastUpdate ? formatTime(lastUpdate) : '-'}
          </Typography>
          {refreshing && <CircularProgress size={16} />}
        </Box>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          Object.entries(grouped).map(([category, items]) => (
            items.length > 0 && (
              <Box key={category} sx={{ mb: 5 }}>
                <Typography variant="h6" fontWeight={700} color="primary" sx={{ mb: 2, pl: 1 }}>
                  {category}
                </Typography>
                <Grid container spacing={{ xs: 2, sm: 3, md: 4 }}>
                  {items.map((instance) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={instance.name}>
                      <Card
                        sx={{
                          cursor: 'pointer',
                          borderRadius: 4,
                          boxShadow: 3,
                          transition: '0.2s',
                          position: 'relative',
                          overflow: 'visible',
                          '&:hover': {
                            boxShadow: 8,
                            transform: 'translateY(-4px) scale(1.03)',
                          },
                        }}
                        onClick={() => handleCardClick(instance)}
                      >
                        {/* Status bar */}
                        <Box sx={{
                          height: 8,
                          width: '100%',
                          bgcolor: instance.online ? 'success.main' : 'error.main',
                          borderTopLeftRadius: 16,
                          borderTopRightRadius: 16,
                        }} />
                        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 3 }}>
                          <StatusAvatar online={instance.online} />
                          <Box>
                            <Typography variant="h6" fontWeight={700} sx={{ color: '#222', mb: 0.5 }}>
                              {instance.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: 15 }}>
                              {instance.host}
                            </Typography>
                            {/* ซ่อนบรรทัด DB: */}
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )
          ))
        )}
      </Box>
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={handleDrawerClose}
        PaperProps={{ sx: { width: { xs: 280, sm: 340 }, borderTopLeftRadius: 24, borderBottomLeftRadius: 24, bgcolor: '#f7fafc' } }}
      >
        <Box sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <IconButton onClick={handleDrawerClose}>
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" fontWeight={700} sx={{ ml: 1 }}>
              {selected?.name}
            </Typography>
          </Box>
          <Divider sx={{ mb: 2 }} />
          {selected && (
            <>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {selected.host} | DB: {selected.database}
              </Typography>
              <Box sx={{ my: 2 }}>
                <StatusAvatar online={selected.online} />
              </Box>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mt: 2 }}>
                Process
              </Typography>
              <List>
                <ListItem button onClick={() => { setCompareOpen(true); fetchCompareData(); }} sx={{ borderRadius: 2 }}>
                  <ListItemIcon>
                    <SettingsIcon />
                  </ListItemIcon>
                  <ListItemText primary="เปรียบเทียบข้อมูล" />
                </ListItem>
                {/* เพิ่ม process อื่นๆ ในอนาคตได้ที่นี่ */}
              </List>
            </>
          )}
        </Box>
      </Drawer>
      {CompareDrawer}
    </Box>
  );
}

export default App;
