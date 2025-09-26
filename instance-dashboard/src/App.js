import React, { useEffect, useState, useMemo, useRef } from 'react';
import axios from 'axios';
import { getApiUrl, getApiEndpoints } from './config';
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
  TextField,
  Modal,
  Backdrop,
  Fade
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import MenuIcon from '@mui/icons-material/Menu';
import RefreshIcon from '@mui/icons-material/Refresh';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import GetAppIcon from '@mui/icons-material/GetApp';
import WifiIcon from '@mui/icons-material/Wifi';
import LocationOnIcon from '@mui/icons-material/LocationOn'; // Added import for LocationOnIcon
import AddIcon from '@mui/icons-material/Add';
import ContentCutIcon from '@mui/icons-material/ContentCut'; // เพิ่ม import สำหรับไอคอนแผนสลิท
import SlitPlan from './components/SlitPlan'; // Added import for SlitPlan
import LocationManagement from './components/LocationManagement';
import { useLocation, useNavigate } from 'react-router-dom';

// ใช้ API endpoints จาก config
const endpoints = getApiEndpoints();
const API_URL = getApiUrl(endpoints.instances);
const REFRESH_INTERVAL = 300000; // 5 นาที (5 * 60 * 1000 = 300000 ms)

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
  const search = window.location.search;
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

  // ซิงก์ Check P ลงเครื่องที่เลือก
  
  
// แก้ไขฟังก์ชัน getStatusDescription
const getStatusDescription = (status) => {
  if (!status) return 'ไม่ทราบสถานะ';
  
  switch (status) {
    case 'normal':
      return 'สัญญาณปกติ';
    case 'network_unstable':
      return 'สัญญาณไม่เสถียร';
    case 'network_slow':
      return 'สัญญาณช้า';
    case 'machine_offline':
      return 'เครื่องไม่ได้เปิด';
    default:
      return 'ไม่ทราบสถานะ';
  }
};

// แก้ไขฟังก์ชัน getStatusColor
const getStatusColor = (status) => {
  if (!status) return '#9e9e9e'; // เทา
  
  switch (status) {
    case 'normal':
      return '#4caf50'; // เขียว
    case 'network_unstable':
    case 'network_slow':
      return '#ff9800'; // ส้ม
    case 'machine_offline':
      return '#f44336'; // แดง
    default:
      return '#9e9e9e'; // เทา
  }
};

function App() {
  const navigate = useNavigate();
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(false);
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
  const [instanceDetails, setInstanceDetails] = useState({}); // ข้อมูลเพิ่มเติมของแต่ละเครื่อง
  const [loadingDetails, setLoadingDetails] = useState({}); // สถานะการโหลดข้อมูลเพิ่มเติม
  const [lastFetchTime, setLastFetchTime] = useState({}); // เวลาที่เรียก API ล่าสุด
  const [loadingStatus, setLoadingStatus] = useState({}); // สถานะการเช็คสถานะเครื่อง
  const [loadingProduction, setLoadingProduction] = useState({}); // สถานะการดึงข้อมูลผลิต
  const [checkingAllStatus, setCheckingAllStatus] = useState(false); // สถานะการเช็คสถานะเครื่องทั้งหมด
  
  // เพิ่ม state สำหรับ user role
  const [userRole, setUserRole] = useState(null);
  const [userLoading, setUserLoading] = useState(false);
  const [locationManagementOpen, setLocationManagementOpen] = useState(false);
  // เพิ่ม state สำหรับแผนสลิท
  const [slitPlanOpen, setSlitPlanOpen] = useState(false);
  // เพิ่ม state สำหรับ Sync Check P
  const [syncingCheckP, setSyncingCheckP] = useState(false);

  // ฟังก์ชันตรวจสอบ Role ของ currentUser
  const checkUserRole = async (currentUser) => {
    if (!currentUser) return;
    
    // แปลง currentUser เป็นตัวเล็ก
    const normalizedUser = currentUser.toLowerCase().trim();
    
    setUserLoading(true);
    try {
      // เรียก API ไปยัง backend เพื่อตรวจสอบ user role
      const response = await axios.post(getApiUrl('/api/auth/check-role'), {
        currentUser: normalizedUser, // ส่งค่า normalized
        dbConfig: {
          host: '192.168.201.115',
          database: 'PP_OCP',
          table: 'tblUsers',
          user: 'sa',
          password: 'gs]HdmiyrpN2523'
        }
      });
      
      if (response.data.success) {
        setUserRole(response.data.userLevel);
      } else {
        setUserRole(null);
      }
    } catch (error) {
      setUserRole(null);
    } finally {
      setUserLoading(false);
    }
  };

  // ฟังก์ชันตรวจสอบว่า user มีสิทธิ์ดูเมนูหรือไม่
  const canViewMenu = (menuType) => {
    if (!userRole) {
      return false;
    }
    
    // แปลง userRole เป็นตัวเล็กเพื่อเปรียบเทียบ
    const normalizedRole = userRole.toLowerCase();
    
    // admin และ dev สามารถดูเมนูทั้งหมด
    if (normalizedRole === 'admin' || normalizedRole === 'dev') {
      return true;
    }
    
    // สำหรับ user level อื่นๆ สามารถกำหนดสิทธิ์เฉพาะได้
    switch (menuType) {
      case 'compare':
        return normalizedRole === 'admin' || normalizedRole === 'dev';
      case 'settings':
        return normalizedRole === 'admin' || normalizedRole === 'dev';
      case 'location':
        return normalizedRole === 'admin' || normalizedRole === 'dev';
      case 'slit':
        return normalizedRole === 'admin' || normalizedRole === 'user';
      case 'sync':
        return normalizedRole === 'admin';
      default:
        return false;
    }
  };

  // ตรวจสอบ currentUser เมื่อ component mount
  useEffect(() => {
    const currentUser = query.get('currentUser');
    if (currentUser) {
      checkUserRole(currentUser);
    }
  }, [query]);

  // แก้ไขฟังก์ชัน fetchInstances
  const fetchInstances = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setRefreshing(true);
    try {
      const res = await axios.get(API_URL);
      
      // เพิ่มค่าเริ่มต้นสำหรับ status ให้กับทุกเครื่อง
      const instancesWithStatus = res.data.map(instance => ({
        ...instance,
        status: instance.online ? 'normal' : 'machine_offline',
        statusText: instance.online ? 'สัญญาณปกติ' : 'เครื่องไม่ได้เปิด',
        statusColor: instance.online ? 'success' : 'error'
      }));
      
      setInstances(instancesWithStatus);
      setLastUpdate(new Date());
      
      // เช็คสถานะเครื่องทันทีหลังจากโหลดรายชื่อ
      await checkAllMachineStatus(instancesWithStatus);
      
      // ดึงข้อมูลผลิตล่าสุดสำหรับทุกเครื่องอัตโนมัติ (หลังจากเช็คสถานะเสร็จ)
      for (let i = 0; i < instancesWithStatus.length; i++) {
        const instance = instancesWithStatus[i];
        // เพิ่ม delay 1000ms ระหว่างการเรียก API
        setTimeout(() => {
          fetchLatestProductionData(instance);
        }, i * 1000);
      }
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

  // ฟังก์ชันเช็คสถานะเครื่อง
  const checkMachineStatus = async (instance) => {
    setLoadingStatus(prev => ({ ...prev, [instance.name]: true }));
    try {
      const response = await axios.get(`${API_URL}/status`, {
        params: { name: instance.name }
      });
      
      const statusInfo = response.data;
      
      // อัพเดตสถานะใน instances array
      setInstances(prev => prev.map(inst => 
        inst.name === instance.name 
          ? { 
              ...inst, 
              online: statusInfo.online,
              status: statusInfo.status,
              statusText: statusInfo.statusText,
              statusColor: statusInfo.statusColor,
              avgPingTime: statusInfo.avgPingTime,
              pingVariance: statusInfo.pingVariance,
              lastChecked: new Date()
            }
          : inst
      ));
      
      // แสดงข้อความตามสถานะ
    } catch (error) {
      setInstances(prev => prev.map(inst => 
        inst.name === instance.name 
          ? { 
              ...inst, 
              online: false, 
              status: 'machine_offline',
              statusText: 'เครื่องไม่ได้เปิด',
              statusColor: 'error'
            }
          : inst
      ));
    } finally {
      setLoadingStatus(prev => ({ ...prev, [instance.name]: false }));
    }
  };

  // ฟังก์ชันเช็คสถานะเครื่องทั้งหมดพร้อมกัน
  const checkAllMachineStatus = async (instances) => {
    if (instances.length === 0) return;
    
    setCheckingAllStatus(true);
    try {
      
      // สร้าง array ของ promises สำหรับเช็คสถานะพร้อมกัน
      const statusPromises = instances.map(async (instance) => {
        try {
          const response = await axios.get(`${API_URL}/status`, {
            params: { name: instance.name }
          });
          
          const statusInfo = response.data;
          
          return {
            name: instance.name,
            success: true,
            data: statusInfo
          };
        } catch (error) {
          return {
            name: instance.name,
            success: false,
            error: error.message
          };
        }
      });
      
      // รอให้ทุกการเช็คสถานะเสร็จสิ้น
      const results = await Promise.all(statusPromises);
      
      // อัพเดตสถานะของทุกเครื่อง
      setInstances(prev => prev.map(inst => {
        const result = results.find(r => r.name === inst.name);
        if (result && result.success) {
          return {
            ...inst,
            online: result.data.online,
            status: result.data.status,
            statusText: result.data.statusText,
            statusColor: result.data.statusColor,
            avgPingTime: result.data.avgPingTime,
            pingVariance: result.data.pingVariance,
            lastChecked: new Date()
          };
        } else if (result && !result.success) {
          return {
            ...inst,
            online: false,
            status: 'machine_offline',
            statusText: 'เครื่องไม่ได้เปิด',
            statusColor: 'error',
            lastChecked: new Date()
          };
        }
        return inst;
      }));
      
    } catch (error) {
    } finally {
      setCheckingAllStatus(false);
    }
  };

  // ฟังก์ชันดึงข้อมูลผลิตล่าสุด
  const fetchLatestProductionData = async (instance) => {
    setLoadingProduction(prev => ({ ...prev, [instance.name]: true }));
    try {
      
      // เรียก card-data API เฉพาะเครื่องที่เลือก
      const cardDataResponse = await axios.get(getApiUrl(`${endpoints.cardData}/${encodeURIComponent(instance.name)}`));
      
      if (cardDataResponse.data.success) {
        const cardData = cardDataResponse.data.data;
        
        setInstanceDetails(prev => ({
          ...prev,
          [instance.name]: cardData
        }));
      } else {
        setInstanceDetails(prev => ({
          ...prev,
          [instance.name]: {
            finishGoods: 'ไม่มีข้อมูล',
            lastProductionDate: 'ไม่มีข้อมูล',
            productionPlan: 'ไม่มีข้อมูล'
          }
        }));
      }
    } catch (error) {
      setInstanceDetails(prev => ({
        ...prev,
        [instance.name]: {
          finishGoods: 'ไม่สามารถดึงข้อมูลได้',
          lastProductionDate: 'ไม่สามารถดึงข้อมูลได้',
          productionPlan: 'ไม่สามารถดึงข้อมูลได้'
        }
      }));
    } finally {
      setLoadingProduction(prev => ({ ...prev, [instance.name]: false }));
    }
  };

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

  const handleSyncCheckP = async () => {
    if (!selected) return;
    if (!canViewMenu('sync')) return;

    setSyncingCheckP(true);
    try {
      await axios.post(`/api/sync/check-p/${encodeURIComponent(selected.name)}/sp`);
      alert(`Sync Check P ลงเครื่อง ${selected.name} สำเร็จ`);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      alert(`Sync ล้มเหลว: ${msg}`);
    } finally {
      setSyncingCheckP(false);
      handleDrawerClose();
    }
  };

  // ฟังก์ชันสำหรับดึงข้อมูลเพิ่มเติมของเครื่อง
  const fetchInstanceDetails = async (instance) => {
    if (!instance.online) return; // ไม่ดึงข้อมูลถ้าเครื่อง offline
    
    setLoadingDetails(prev => ({ ...prev, [instance.name]: true }));
    
    try {
      // ส่งชื่อเครื่องเต็มไปให้ backend
      const machineParam = instance.name;
      
      // ดึงข้อมูล finish goods ล่าสุด
      const finishGoodsResponse = await axios.get(getApiUrl(`${endpoints.finishGoods}?name=${encodeURIComponent(instance.name)}`));
      
      // ดึงข้อมูลแผนผลิต
      const productionPlanResponse = await axios.get(getApiUrl(`${endpoints.productionPlan}?name=${encodeURIComponent(instance.name)}`));
      
      const cardData = {
        finishGoods: finishGoodsResponse.data?.size || 'ไม่มีข้อมูล',
        productionPlan: productionPlanResponse.data?.maktx || 'ไม่มีข้อมูล'
      };
      
      setInstanceDetails(prev => {
        const newState = {
          ...prev,
          [instance.name]: cardData
        };
        return newState;
      });
    } catch (error) {
      setInstanceDetails(prev => ({
        ...prev,
        [instance.name]: {
          finishGoods: 'ไม่สามารถดึงข้อมูลได้',
          productionPlan: 'ไม่สามารถดึงข้อมูลได้'
        }
      }));
    } finally {
      setLoadingDetails(prev => ({ ...prev, [instance.name]: false }));
    }
  };

  // ดึงข้อมูลเปรียบเทียบจาก API
  const fetchCompareData = async () => {
    if (!compareDates.from || !compareDates.to || !selected) {
      return;
    }
    
    setLoadingCompare(true);
    try {
      // ดึงข้อมูลทั้งสองฝั่งพร้อมกัน
      const response = await axios.get(getApiUrl(endpoints.compare.both), {
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
      setStationData([]);
      setPlanData([]);
    } finally {
      setLoadingCompare(false);
    }
  };

  // อัพเดตข้อมูล Production Plan
  const handleUpdateData = async () => {
    if (!compareDates.from || !compareDates.to || !selected) {
      alert('กรุณาเลือกวันที่และเครื่องที่ต้องการอัพเดต');
      return;
    }
    
    // ตรวจสอบว่ามีข้อมูล Station หรือไม่
    if (stationData.length === 0) {
      alert('ไม่พบข้อมูลจาก Station ที่จะอัพเดต กรุณาโหลดข้อมูลก่อน');
      return;
    }
    
    // ยืนยันการอัพเดต
    if (!window.confirm(`ต้องการอัพเดตข้อมูลจาก ${compareDates.from} ถึง ${compareDates.to} สำหรับเครื่อง ${selected.name} หรือไม่?\n\nจำนวนข้อมูลที่จะอัพเดต: ${stationData.length} รายการ`)) {
      return;
    }
    
    setUpdating(true);
    try {
      // Debug: ตรวจสอบ currentUser
      const currentUser = query.get('currentUser');
      console.log('Current User from URL:', currentUser);
      console.log('Full URL:', window.location.href);
      
      const response = await axios.post(getApiUrl(endpoints.compare.update), {
        name: selected.name,
        station: selected.name,
        fromDate: compareDates.from,
        toDate: compareDates.to,
        shift: 'Z',
        user: currentUser || 'system'
      });
      
      // รีเฟรชข้อมูลหลังจากอัพเดต
      await fetchCompareData();
      
      // แสดงผลลัพธ์ที่ละเอียดขึ้น
      let successMessage = '✅ อัพเดตข้อมูลสำเร็จ';
      if (response.data.updated !== undefined && response.data.inserted !== undefined) {
        successMessage += `\n\n- อัพเดต: ${response.data.updated} รายการ`;
        successMessage += `\n- เพิ่มใหม่: ${response.data.inserted} รายการ`;
      }
      alert(successMessage);
    } catch (error) {
      let errorMessage = 'เกิดข้อผิดพลาดในการอัพเดตข้อมูล';
      if (error.response) {
        // มี response จาก server
        if (error.response.data && error.response.data.error) {
          errorMessage = error.response.data.error;
        } else if (error.response.status === 404) {
          errorMessage = 'ไม่พบเครื่องที่ระบุ';
        } else if (error.response.status === 400) {
          errorMessage = 'ข้อมูลไม่ถูกต้อง';
        } else if (error.response.status === 500) {
          errorMessage = 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์';
        }
      } else if (error.request) {
        // ไม่มี response (network error)
        errorMessage = 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้';
      }
      
      alert(`❌ ${errorMessage}\n\nรายละเอียด: ${error.message}`);
    } finally {
      setUpdating(false);
    }
  };

  // แปลงเวลาอัปเดตล่าสุด
  const formatTime = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // ฟังก์ชันสำหรับ format วันที่เป็น YYYY-MM-DD
  const formatDateForInput = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // ฟังก์ชันสำหรับเปิด compare drawer พร้อม set วันที่ default
  const openCompareDrawer = () => {
    const today = formatDateForInput(new Date());
    setCompareDates({ from: today, to: today });
    setCompareOpen(true);
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
            {updating ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                อัพเดต...
              </>
            ) : (
              'อัพเดต'
            )}
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
                        <TableCell>{formatDateForInput(row.doc_date)}</TableCell>
                        <TableCell>{row.material}</TableCell>
                        <TableCell>{row.rmd_size}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
          {/* ปุ่ม >> */}
          <Box sx={{ display: 'flex', alignItems: 'center', px: 1 }}>
            <Button 
              variant="outlined" 
              sx={{ minWidth: 0, p: 1 }}
              onClick={handleUpdateData}
              disabled={updating || stationData.length === 0}
              title="อัพเดตข้อมูลจาก Station ไปยัง Production Plan"
            >
              {updating ? (
                <CircularProgress size={24} />
              ) : (
                <ChevronRightIcon fontSize="large" />
              )}
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
                        <TableCell>{formatDateForInput(row.postingdate)}</TableCell>
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

  // แสดงข้อมูล User Role
  const DrawerContent = (
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
      
      {/* แสดงข้อมูล User Role */}
      {userLoading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <CircularProgress size={20} sx={{ mr: 1 }} />
          <Typography variant="body2" color="text.secondary">
            กำลังตรวจสอบสิทธิ์...
          </Typography>
        </Box>
      ) : userRole ? (
        <Box sx={{ mb: 2, p: 2, bgcolor: 'primary.light', borderRadius: 2 }}>
          <Typography variant="body2" color="primary.contrastText" fontWeight={600}>
            สิทธิ์: {userRole === 'admin' ? 'ผู้ดูแลระบบ' : userRole === 'dev' ? 'นักพัฒนา' : userRole}
          </Typography>
          <Typography variant="caption" color="primary.contrastText" sx={{ opacity: 0.8 }}>
            Raw value: {userRole}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ mb: 2, p: 2, bgcolor: 'error.light', borderRadius: 2 }}>
          <Typography variant="body2" color="error.contrastText" fontWeight={600}>
            ไม่พบสิทธิ์ผู้ใช้
          </Typography>
        </Box>
      )}
      
      {selected && (
        <>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {selected.host} | DB: {selected.database}
          </Typography>
          <Box sx={{ my: 2 }}>
            <StatusAvatar online={selected.online} />
          </Box>
          {selected.online && (
            <>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mt: 2 }}>
                Process
              </Typography>
              <List>
                {/* เมนูเปรียบเทียบข้อมูล - แสดงเฉพาะ admin และ dev */}
                {canViewMenu('compare') && (
                  <ListItem button onClick={openCompareDrawer} sx={{ borderRadius: 2 }}>
                    <ListItemIcon>
                      <SettingsIcon />
                    </ListItemIcon>
                    <ListItemText primary="เปรียบเทียบข้อมูล" />
                  </ListItem>
                )}

                {/* เมนูเพิ่ม Location */}
                {canViewMenu('location') && (
                  <ListItem button onClick={() => setLocationManagementOpen(true)} sx={{ borderRadius: 2 }}>
                    <ListItemIcon>
                      <LocationOnIcon />
                    </ListItemIcon>
                    <ListItemText primary="เพิ่ม Location" />
                  </ListItem>
                )}

                {/* เมนูแผนสลิท */}
                {canViewMenu('slit') && (
                  <ListItem button onClick={() => setSlitPlanOpen(true)} sx={{ borderRadius: 2 }}>
                    <ListItemIcon>
                      <ContentCutIcon />
                    </ListItemIcon>
                    <ListItemText primary="แผนสลิท" />
                  </ListItem>
                )}

                {/* เมนู Sync Check P */}
                {canViewMenu('sync') && (
                  <ListItem
                    button
                    onClick={(e) => { e.stopPropagation(); handleSyncCheckP(); }}
                    disabled={syncingCheckP}
                    sx={{ borderRadius: 2 }}
                  >
                    <ListItemIcon>
                      <GetAppIcon />
                    </ListItemIcon>
                    <ListItemText primary={syncingCheckP ? 'กำลังซิงก์...' : 'Sync Check P'} />
                  </ListItem>
                )}

                {/* เมนูตั้งค่าระบบ */}
                {canViewMenu('settings') && (
                  <ListItem button sx={{ borderRadius: 2 }}>
                    <ListItemIcon>
                      <SettingsIcon />
                    </ListItemIcon>
                    <ListItemText primary="ตั้งค่าระบบ" />
                  </ListItem>
                )}

                {/* เมนูเพิ่ม Check P - removed from Drawer per request */}

                {/* แสดงข้อความเมื่อไม่มีสิทธิ์ */}
                {!canViewMenu('compare') && !canViewMenu('settings') && !canViewMenu('location') && !canViewMenu('slit') && !canViewMenu('sync') && (
                  <ListItem>
                    <ListItemText 
                      primary="ไม่มีสิทธิ์เข้าถึงเมนู" 
                      secondary={`สิทธิ์ปัจจุบัน: ${userRole || 'ไม่พบ'}`}
                      sx={{ color: 'text.secondary' }}
                    />
                  </ListItem>
                )}
              </List>
            </>
          )}
          {/* ลบ LocationManagement ออกจาก DrawerContent ตรงนี้ */}
          {/* <Box sx={{ mt: 1 }}>
            <LocationManagement machine={selected?.name} compact />
          </Box> */}
        </>
      )}
    </Box>
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
          <Tooltip title="เช็คสถานะเครื่องทั้งหมด">
            <span>
              <IconButton 
                color="secondary" 
                onClick={() => checkAllMachineStatus(instances)} 
                disabled={refreshing || instances.length === 0 || checkingAllStatus}
                sx={{ mr: 1 }}
              >
                {checkingAllStatus ? <CircularProgress size={24} /> : <WifiIcon />}
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="โหลดรายชื่อเครื่อง">
            <span>
              <IconButton color="primary" onClick={() => fetchInstances()} disabled={refreshing}>
                {refreshing ? <CircularProgress size={24} /> : <RefreshIcon />}
              </IconButton>
            </span>
          </Tooltip>
          {canViewMenu('sync') && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => navigate(`/check-p/new${query.get('currentUser') ? `?currentUser=${encodeURIComponent(query.get('currentUser'))}` : ''}`)}
              sx={{ ml: 1 }}
            >
              เพิ่ม Check P
            </Button>
          )}
        </Toolbar>
      </AppBar>
      <Box sx={{ p: { xs: 2, sm: 4 }, maxWidth: 1400, mx: 'auto', mt: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {lastUpdate ? `อัปเดตล่าสุด: ${formatTime(lastUpdate)}` : 'ยังไม่ได้โหลดข้อมูล'}
          </Typography>
          {refreshing && <CircularProgress size={16} />}
          {checkingAllStatus && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={16} />
              <Typography variant="caption" color="text.secondary">
                กำลังเช็คสถานะเครื่อง...
              </Typography>
            </Box>
          )}
        </Box>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
            <CircularProgress />
          </Box>
        ) : instances.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8, flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <Typography variant="h6" color="text.secondary">
              ยังไม่มีข้อมูลเครื่อง
            </Typography>
            <Button 
              variant="contained" 
              onClick={() => fetchInstances()}
              startIcon={<RefreshIcon />}
            >
              โหลดรายชื่อเครื่อง
            </Button>
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
                          borderRadius: 3,
                          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          position: 'relative',
                          overflow: 'hidden',
                          minHeight: 320,
                          minWidth: 320,
                          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                          border: '1px solid rgba(0,0,0,0.05)',
                          '&:hover': {
                            boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
                            transform: 'translateY(-8px) scale(1.02)',
                            borderColor: instance.online ? 'primary.main' : 'error.main',
                          },
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: 4,
                            background: instance.online 
                              ? 'linear-gradient(90deg, #4caf50, #66bb6a)' 
                              : 'linear-gradient(90deg, #f44336, #ef5350)',
                            zIndex: 1
                          }
                        }}
                        onClick={() => handleCardClick(instance)}
                      >
                        {/* เพิ่มคำอธิบายสีในมุมบนขวา */}
                        <Box sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          zIndex: 10,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5
                        }}>
                          <Box sx={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            bgcolor: getStatusColor(instance.status),
                            border: '1px solid rgba(255,255,255,0.8)',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                          }} />
                          <Typography variant="caption" sx={{
                            fontSize: 10,
                            color: 'rgba(0,0,0,0.6)',
                            fontWeight: 500,
                            textShadow: '0 1px 2px rgba(255,255,255,0.8)',
                            backgroundColor: 'rgba(255,255,255,0.9)',
                            padding: '1px 4px',
                            borderRadius: 1,
                            border: '1px solid rgba(0,0,0,0.1)'
                          }}>
                            {getStatusDescription(instance.status)}
                          </Typography>
                        </Box>

                        <CardContent sx={{ p: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
                          {/* Header Section with Gradient Background */}
                          <Box sx={{
                            background: instance.online 
                              ? 'linear-gradient(135deg, #e8f5e8 0%, #f1f8e9 100%)'
                              : 'linear-gradient(135deg, #ffebee 0%, #fce4ec 100%)',
                            p: 3,
                            borderBottom: '1px solid rgba(0,0,0,0.05)',
                            position: 'relative'
                          }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <Box sx={{ position: 'relative' }}>
                                <Avatar 
                                  sx={{ 
                                    width: 60, 
                                    height: 60, 
                                    bgcolor: instance.online ? 'success.main' : 'grey.400',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                    border: '3px solid white'
                                  }}
                                >
                                  <PowerSettingsNewIcon sx={{ fontSize: 28 }} />
                                </Avatar>
                                <Box sx={{
                                  position: 'absolute',
                                  top: -2,
                                  right: -2,
                                  width: 20,
                                  height: 20,
                                  borderRadius: '50%',
                                  bgcolor: getStatusColor(instance.status),
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  border: '2px solid white',
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                                }}>
                                  {instance.online ? (
                                    <CheckCircleIcon sx={{ fontSize: 12, color: 'white' }} />
                                  ) : (
                                    <CancelIcon sx={{ fontSize: 12, color: 'white' }} />
                                  )}
                                </Box>
                              </Box>
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="h6" fontWeight={700} sx={{ 
                                  color: '#1a237e', 
                                  mb: 0.5,
                                  fontSize: '1.1rem'
                                }}>
                                  {instance.name}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ 
                                  fontSize: 13,
                                  opacity: 0.8
                                }}>
                                  {instance.host}
                                </Typography>
                                <Box sx={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  mt: 1,
                                  gap: 1
                                }}>
                                  <Box sx={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    bgcolor: getStatusColor(instance.status),
                                    animation: instance.online ? 'pulse 2s infinite' : 'none',
                                    '@keyframes pulse': {
                                      '0%': { opacity: 1 },
                                      '50%': { opacity: 0.5 },
                                      '100%': { opacity: 1 }
                                    }
                                  }} />
                                  <Typography variant="caption" sx={{ 
                                    color: getStatusColor(instance.status),
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: 0.5
                                  }}>
                                    {instance.statusText || (instance.online ? 'Online' : 'Offline')}
                                  </Typography>
                                </Box>
                                
                                {/* เพิ่มข้อมูล Ping และเวลาอัปเดต */}
                                {instance.online && instance.avgPingTime && (
                                  <Typography variant="caption" color="text.secondary" sx={{ 
                                    fontSize: 10,
                                    display: 'block',
                                    mt: 0.5
                                  }}>
                                    Ping: {instance.avgPingTime}ms
                                    {instance.pingVariance > 100 && ` (Variance: ${instance.pingVariance}ms)`}
                                  </Typography>
                                )}
                                
                                {instance.lastChecked && (
                                  <Typography variant="caption" color="text.secondary" sx={{ 
                                    fontSize: 10,
                                    display: 'block'
                                  }}>
                                    อัปเดต: {formatTime(instance.lastChecked)}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          </Box>
                          
                          {/* Production Data Section */}
                          <Box sx={{ flex: 1, p: 3, display: 'flex', flexDirection: 'column' }}>
                            {instanceDetails[instance.name] ? (
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="subtitle1" fontWeight={600} color="primary" sx={{ 
                                  mb: 3,
                                  fontSize: '1rem',
                                  textAlign: 'center',
                                  color: '#1976d2'
                                }}>
                                  📊 ข้อมูลการผลิตล่าสุด
                                </Typography>
                                
                                {/* Finish Goods */}
                                <Box sx={{ 
                                  mb: 3,
                                  p: 2,
                                  bgcolor: 'rgba(25, 118, 210, 0.05)',
                                  borderRadius: 2,
                                  border: '1px solid rgba(25, 118, 210, 0.1)'
                                }}>
                                  <Typography variant="caption" color="text.secondary" sx={{ 
                                    fontWeight: 600, 
                                    mb: 1,
                                    display: 'block',
                                    textTransform: 'uppercase',
                                    letterSpacing: 0.5
                                  }}>
                                    🏭 Finish Goods
                                  </Typography>
                                  <Typography variant="body1" color="text.primary" sx={{ 
                                    fontWeight: 700, 
                                    fontSize: 18,
                                    color: '#1976d2'
                                  }}>
                                    {instanceDetails[instance.name]?.finishGoods || 'ไม่มีข้อมูล'}
                                  </Typography>
                                </Box>
                                
                                {/* Last Production Date */}
                                <Box sx={{ 
                                  mb: 3,
                                  p: 2,
                                  bgcolor: 'rgba(76, 175, 80, 0.05)',
                                  borderRadius: 2,
                                  border: '1px solid rgba(76, 175, 80, 0.1)'
                                }}>
                                  <Typography variant="caption" color="text.secondary" sx={{ 
                                    fontWeight: 600, 
                                    mb: 1,
                                    display: 'block',
                                    textTransform: 'uppercase',
                                    letterSpacing: 0.5
                                  }}>
                                    📅 วันที่ผลิตล่าสุด
                                  </Typography>
                                  <Typography variant="body1" color="text.primary" sx={{ 
                                    fontWeight: 700, 
                                    fontSize: 18,
                                    color: '#4caf50'
                                  }}>
                                    {instanceDetails[instance.name]?.lastProductionDate || 'ไม่มีข้อมูล'}
                                  </Typography>
                                </Box>
                                
                                {/* Production Plan */}
                                <Box sx={{ 
                                  p: 2,
                                  bgcolor: 'rgba(255, 152, 0, 0.05)',
                                  borderRadius: 2,
                                  border: '1px solid rgba(255, 152, 0, 0.1)'
                                }}>
                                  <Typography variant="caption" color="text.secondary" sx={{ 
                                    fontWeight: 600, 
                                    mb: 1,
                                    display: 'block',
                                    textTransform: 'uppercase',
                                    letterSpacing: 0.5
                                  }}>
                                    📋 แผนการผลิต
                                  </Typography>
                                  <Typography variant="body1" color="text.primary" sx={{ 
                                    fontWeight: 700, 
                                    fontSize: 18,
                                    color: '#ff9800'
                                  }}>
                                    {instanceDetails[instance.name]?.productionPlan || 'ไม่มีข้อมูล'}
                                  </Typography>
                                </Box>
                              </Box>
                            ) : (
                              <Box sx={{ 
                                flex: 1, 
                                display: 'flex', 
                                flexDirection: 'column', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                textAlign: 'center',
                                py: 4
                              }}>
                                <Box sx={{
                                  width: 80,
                                  height: 80,
                                  borderRadius: '50%',
                                  bgcolor: 'rgba(0,0,0,0.05)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  mb: 2
                                }}>
                                  <GetAppIcon sx={{ fontSize: 40, color: 'rgba(0,0,0,0.3)' }} />
                                </Box>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                  กำลังโหลดข้อมูลการผลิต...
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ opacity: 0.7 }}>
                                  กรุณารอสักครู่
                                </Typography>
                              </Box>
                            )}
                          </Box>
                          
                          {/* Action Buttons Section */}
                          <Box sx={{ 
                            p: 3,
                            background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                            borderTop: '1px solid rgba(0,0,0,0.05)',
                            display: 'flex',
                            gap: 2
                          }}>
                            <Tooltip title="เช็คสถานะเครื่อง">
                              <IconButton
                                size="large"
                                color="primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  checkMachineStatus(instance);
                                }}
                                disabled={loadingStatus[instance.name]}
                                sx={{ 
                                  bgcolor: 'primary.main', 
                                  color: 'white',
                                  '&:hover': { 
                                    bgcolor: 'primary.dark',
                                    transform: 'scale(1.05)'
                                  },
                                  '&:disabled': { bgcolor: 'grey.300' },
                                  flex: 1,
                                  height: 48,
                                  boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)',
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                {loadingStatus[instance.name] ? (
                                  <CircularProgress size={24} color="inherit" />
                                ) : (
                                  <WifiIcon fontSize="large" />
                                )}
                              </IconButton>
                            </Tooltip>
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
        {DrawerContent}
      </Drawer>
      <Modal
        open={locationManagementOpen}
        onClose={() => setLocationManagementOpen(false)}
        aria-labelledby="location-management-modal-title"
        aria-describedby="location-management-modal-description"
        closeAfterTransition
        slots={{ backdrop: Backdrop }}
        slotProps={{
          backdrop: {
            timeout: 300,
          },
        }}
      >
        <Fade in={locationManagementOpen}>
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: { xs: '95vw', sm: 600, md: 700 },
              maxWidth: '98vw',
              maxHeight: { xs: '90vh', sm: 600, md: 700 },
              bgcolor: 'background.paper',
              boxShadow: 24,
              p: 3,
              borderRadius: 3,
              outline: 'none',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <LocationManagement machine={selected?.name} />
          </Box>
        </Fade>
      </Modal>
      <Modal
        open={slitPlanOpen}
        onClose={() => setSlitPlanOpen(false)}
        aria-labelledby="slit-plan-modal-title"
        aria-describedby="slit-plan-modal-description"
        closeAfterTransition
        slots={{ backdrop: Backdrop }}
        slotProps={{
          backdrop: {
            timeout: 300,
          },
        }}
      >
        <Fade in={slitPlanOpen}>
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: { xs: '95vw', sm: '80vw', md: '70vw' },
              maxWidth: 1200,
              maxHeight: '90vh',
              bgcolor: 'background.paper',
              borderRadius: 2,
              boxShadow: 24,
              p: 0,
              overflow: 'hidden',
            }}
          >
            <SlitPlan 
              machine={selected?.name} 
              onClose={() => setSlitPlanOpen(false)}
            />
          </Box>
        </Fade>
      </Modal>
      {CompareDrawer}
    </Box>
  );
}

export default App;
