import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Box, Grid, Card, CardContent, Typography, TextField, Button,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Paper,
  Pagination, Stack, Divider
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import HomeIcon from '@mui/icons-material/Home';
import SaveIcon from '@mui/icons-material/Save';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import { useNavigate, useLocation } from 'react-router-dom';

// Schema constraints
const constraints = {
  matcode: { required: true, max: 40, type: 'string' },
  length: { required: true, max: 100, type: 'string' },
  size: { required: true, max: 100, type: 'string' },
  qty: { required: true, type: 'int' },
  matgroup: { required: true, max: 100, type: 'string' },
  minweight: { required: false, type: 'float' },
  maxweight: { required: false, type: 'float' },
  mintisweight: { required: false, type: 'float' },
  maxtisweight: { required: false, type: 'float' },
  remark: { required: false, max: 40, type: 'string' },
  internal_size: { required: true, max: 100, type: 'string' },
  // hidden fields below will be omitted from UI but can be sent if needed
  color: { required: false, max: 40, type: 'string' },
  speed: { required: false, type: 'int' },
  table_weight: { required: false, type: 'decimal3' }, // numeric(18,3)
  sap_description: { required: false, max: 100, type: 'string' },
  actual_thickness: { required: false, type: 'float' },
  cIn: { required: false, type: 'float' },
  cOut: { required: false, type: 'float' },
};

const visibleFields = [
  'matcode','length','size','qty','matgroup',
  'minweight','maxweight','mintisweight','maxtisweight',
  'remark','internal_size','table_weight'
]; // hidden: color, speed, sap_description, actual_thickness, cIn, cOut

function parseValueByType(val, type) {
  if (val === '' || val === null || val === undefined) return null;
  switch (type) {
    case 'int': {
      const n = Number(val); return Number.isInteger(n) ? n : NaN;
    }
    case 'float': {
      const n = Number(val); return Number.isFinite(n) ? n : NaN;
    }
    case 'decimal3': {
      const n = Number(val); if (!Number.isFinite(n)) return NaN;
      const parts = String(val).split('.'); if (parts[1] && parts[1].length > 3) return NaN;
      return n;
    }
    default: return String(val);
  }
}

function validateForm(form) {
  const errors = {};
  for (const k of Object.keys(constraints)) {
    const rule = constraints[k];
    if (!visibleFields.includes(k)) continue; // validate only visible fields in UI

    const raw = form[k];
    if (rule.required && (raw === '' || raw === null || raw === undefined)) {
      errors[k] = 'จำเป็นต้องกรอก'; continue;
    }
    if (raw === '' || raw === null || raw === undefined) continue;

    if (rule.type === 'string') {
      const s = String(raw);
      if (rule.max && s.length > rule.max) errors[k] = `ยาวเกิน ${rule.max} ตัวอักษร`;
    } else {
      const parsed = parseValueByType(raw, rule.type);
      if (Number.isNaN(parsed)) errors[k] = 'รูปแบบตัวเลขไม่ถูกต้อง';
    }
  }
  return errors;
}

export default function CheckPForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const currentUser = params.get('currentUser');

  const [form, setForm] = useState({
    matcode: '', length: '', size: '', qty: '',
    matgroup: '', minweight: '', maxweight: '', mintisweight: '',
    maxtisweight: '', remark: '', internal_size: '', table_weight: '',
    // hidden defaults
    color: null, speed: null, sap_description: null,
    actual_thickness: null, cIn: null, cOut: null
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Search & pagination
  const [search, setSearch] = useState('');
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const totalPages = useMemo(() => Math.max(Math.ceil(total / pageSize), 1), [total]);

  const onChange = (k, v) => {
    setForm(s => ({ ...s, [k]: v }));
    if (errors[k]) setErrors(e => { const ne = { ...e }; delete ne[k]; return ne; });
  };

  const submit = async () => {
    const v = validateForm(form);
    setErrors(v);
    if (Object.keys(v).length > 0) return;

    const payload = {};
    for (const k of Object.keys(constraints)) {
      const rule = constraints[k];
      const raw = form[k];
      if (raw === '' || raw === null || raw === undefined) payload[k] = null;
      else if (rule.type && rule.type !== 'string') payload[k] = parseValueByType(raw, rule.type);
      else payload[k] = String(raw);
    }

    setSaving(true);
    try {
      await axios.post('/api/sync/check-p', payload);
      fetchList(page, search);
    } finally {
      setSaving(false);
    }
  };

  async function fetchList(p = 1, s = '') {
    const res = await axios.get('/api/sync/check-p', { params: { page: p, pageSize, search: s } });
    if (res.data?.success) {
      setList(res.data.data || []);
      setTotal(res.data.total || 0);
      setPage(res.data.page || 1);
    }
  }

  useEffect(() => { fetchList(1, ''); }, []);

  const renderField = (name, label) => {
    const rule = constraints[name];
    const isNumber = ['int', 'float', 'decimal3'].includes(rule.type);
    const step = rule.type === 'int' ? 1 : (rule.type === 'decimal3' ? 0.001 : 'any');
    return (
      <TextField
        fullWidth
        label={`${label}${rule.required ? ' *' : ''}`}
        value={form[name] ?? ''}
        onChange={e => onChange(name, e.target.value)}
        type={isNumber ? 'number' : 'text'}
        inputProps={isNumber ? { step } : { maxLength: rule.max || undefined }}
        error={Boolean(errors[name])}
        helperText={errors[name] || ' '}
        size="small"
      />
    );
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1300, mx: 'auto' }}>
      {/* Header Card */}
      <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #e3f2fd 0%, #e8f5e9 100%)' }} elevation={0}>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" spacing={2}>
            <Typography variant="h5" fontWeight={800} color="primary.dark">
              เพิ่ม/แก้ไข Check P (Central)
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<ArrowBackIcon />}
                onClick={() => navigate(`/dashboard${currentUser ? `?currentUser=${encodeURIComponent(currentUser)}` : ''}`)}
              >
                กลับหน้า Home
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>ข้อมูล Check P</Typography>
          <Grid container spacing={2}>
            {visibleFields.map((f) => (
              <Grid item xs={12} sm={6} md={4} key={f}>
                {renderField(f, f)}
              </Grid>
            ))}
          </Grid>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Button variant="contained" startIcon={<SaveIcon />} onClick={submit} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="outlined" startIcon={<CleaningServicesIcon />} onClick={() => { setForm({
              matcode:'', length:'', size:'', qty:'', matgroup:'', minweight:'', maxweight:'',
              mintisweight:'', maxtisweight:'', remark:'', internal_size:'', table_weight:'',
              color:null, speed:null, sap_description:null, actual_thickness:null, cIn:null, cOut:null
            }); setErrors({}); }}>
              Clear
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Typography variant="h6" sx={{ mb: 1 }}>ค้นหาและรายการ Check P</Typography>
      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
            <TextField
              fullWidth
              placeholder="ค้นหา: matcode / size / matgroup / internal_size / sap_description"
              value={search}
              onChange={e => setSearch(e.target.value)}
              size="small"
            />
            <Button startIcon={<SearchIcon />} variant="contained" onClick={() => fetchList(1, search)}>ค้นหา</Button>
            <Button startIcon={<ClearIcon />} variant="outlined" onClick={() => { setSearch(''); fetchList(1, ''); }}>ล้าง</Button>
          </Stack>

          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  {['matcode','size','length','qty','matgroup','internal_size','last_update'].map(h => (
                    <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {list.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ color: 'text.secondary' }}>ไม่พบข้อมูล</TableCell>
                  </TableRow>
                ) : (
                  list.map((row, idx) => (
                    <TableRow key={idx} hover>
                      <TableCell>{row.matcode}</TableCell>
                      <TableCell>{row.size}</TableCell>
                      <TableCell>{row.length}</TableCell>
                      <TableCell>{row.qty}</TableCell>
                      <TableCell>{row.matgroup}</TableCell>
                      <TableCell>{row.internal_size}</TableCell>
                      <TableCell>{row.last_update ? new Date(row.last_update).toLocaleString() : ''}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              ทั้งหมด {total} รายการ
            </Typography>
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_, p) => fetchList(p, search)}
              color="primary"
            />
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
