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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { getApiUrl } from '../config';

const LocationManagement = ({ machine }) => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ Plant: '', Location: '', description: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const apiEndpoint = getApiUrl('/api/locations');

  // ดึงข้อมูล location เฉพาะเครื่อง
  const fetchLocations = async () => {
    if (!machine) return;
    setLoading(true);
    try {
      const response = await axios.get(`${apiEndpoint}?machine=${encodeURIComponent(machine)}`);
      setLocations(response.data);
    } catch (error) {
      console.error('Error fetching locations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
    // eslint-disable-next-line
  }, [machine]);

  const handleFormChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!machine) return;
    const url = isEditing
      ? `${apiEndpoint}/${editingLocation}?machine=${encodeURIComponent(machine)}`
      : `${apiEndpoint}?machine=${encodeURIComponent(machine)}`;
    const method = isEditing ? 'put' : 'post';

    try {
      await axios({ method, url, data: form });
      fetchLocations();
      handleCloseForm();
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };

  const handleEdit = (location) => {
    setIsEditing(true);
    setEditingLocation(location.Location);
    setForm({ Plant: location.Plant, Location: location.Location, description: location.description });
    setShowForm(true);
  };

  const handleDelete = async (location) => {
    if (!machine) return;
    try {
      await axios.delete(
        `${apiEndpoint}/${location.Location}?machine=${encodeURIComponent(machine)}`,
        { data: { Plant: location.Plant } }
      );
      fetchLocations();
    } catch (error) {
      console.error('Error deleting location:', error);
    }
  };

  const handleAdd = () => {
    setIsEditing(false);
    setEditingLocation(null);
    setForm({ Plant: '', Location: '', description: '' });
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setIsEditing(false);
    setEditingLocation(null);
    setForm({ Plant: '', Location: '', description: '' });
    setShowForm(false);
  };

  return (
    <Paper elevation={0} sx={{
      p: 2,
      bgcolor: 'background.default',
      borderRadius: 2,
      boxShadow: 'none',
      maxHeight: { xs: 400, sm: 500 },
      overflowY: 'auto',
      minWidth: { xs: '80vw', sm: 500 }
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ flex: 1 }}>
          จัดการ Location
        </Typography>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={handleAdd}
        >
          เพิ่ม
        </Button>
      </Box>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer sx={{ maxHeight: 250 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Plant</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {locations.map((loc) => (
                <TableRow key={loc.Location}>
                  <TableCell>{loc.Plant}</TableCell>
                  <TableCell>{loc.Location}</TableCell>
                  <TableCell>{loc.description}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleEdit(loc)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDelete(loc)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {locations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ color: 'text.secondary' }}>
                    ไม่พบข้อมูล
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Popup ฟอร์มเพิ่ม/แก้ไข */}
      <Dialog open={showForm} onClose={handleCloseForm} maxWidth="xs" fullWidth>
        <DialogTitle>{isEditing ? 'แก้ไข Location' : 'เพิ่ม Location'}</DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <TextField
              label="Plant"
              name="Plant"
              value={form.Plant}
              onChange={handleFormChange}
              required
              fullWidth
              margin="dense"
              disabled={isEditing}
            />
            <TextField
              label="Location"
              name="Location"
              value={form.Location}
              onChange={handleFormChange}
              required
              fullWidth
              margin="dense"
              disabled={isEditing}
            />
            <TextField
              label="Description"
              name="description"
              value={form.description}
              onChange={handleFormChange}
              fullWidth
              margin="dense"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseForm}>ยกเลิก</Button>
            <Button type="submit" variant="contained">{isEditing ? 'บันทึก' : 'เพิ่ม'}</Button>
          </DialogActions>
        </form>
      </Dialog>
    </Paper>
  );
};

export default LocationManagement;