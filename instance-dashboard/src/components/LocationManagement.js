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
    CircularProgress
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { getApiUrl } from '../config';

const LocationManagement = () => {
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({ Plant: '2010', Location: '', description: '' });
    const [isEditing, setIsEditing] = useState(false);
    const [editingLocation, setEditingLocation] = useState(null);

    const apiEndpoint = getApiUrl('/api/locations');

    const fetchLocations = async () => {
        setLoading(true);
        try {
            const response = await axios.get(apiEndpoint);
            setLocations(response.data);
        } catch (error) {
            console.error('Error fetching locations:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLocations();
    }, []);

    const handleFormChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const url = isEditing ? `${apiEndpoint}/${editingLocation}` : apiEndpoint;
        const method = isEditing ? 'put' : 'post';

        try {
            await axios({ method, url, data: form });
            fetchLocations();
            resetForm();
        } catch (error) {
            console.error('Error submitting form:', error);
        }
    };

    const handleEdit = (location) => {
        setIsEditing(true);
        setEditingLocation(location.Location);
        setForm({ Plant: location.Plant, Location: location.Location, description: location.description });
    };

    const handleDelete = async (location) => {
        try {
            await axios.delete(`${apiEndpoint}/${location.Location}`, { data: { Plant: location.Plant } });
            fetchLocations();
        } catch (error) {
            console.error('Error deleting location:', error);
        }
    };

    const resetForm = () => {
        setIsEditing(false);
        setEditingLocation(null);
        setForm({ Plant: '2010', Location: '', description: '' });
    };

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
                Location Management
            </Typography>

            <form onSubmit={handleSubmit}>
                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                    <TextField label="Plant" name="Plant" value={form.Plant} onChange={handleFormChange} required disabled />
                    <TextField label="Location" name="Location" value={form.Location} onChange={handleFormChange} required disabled={isEditing} />
                    <TextField label="Description" name="description" value={form.description} onChange={handleFormChange} />
                    <Button type="submit" variant="contained">
                        {isEditing ? 'Update' : 'Add'}
                    </Button>
                    {isEditing && (
                        <Button variant="outlined" onClick={resetForm}>
                            Cancel
                        </Button>
                    )}
                </Box>
            </form>

            {loading ? (
                <CircularProgress />
            ) : (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Plant</TableCell>
                                <TableCell>Location</TableCell>
                                <TableCell>Description</TableCell>
                                <TableCell>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {locations.map((loc) => (
                                <TableRow key={loc.Location}>
                                    <TableCell>{loc.Plant}</TableCell>
                                    <TableCell>{loc.Location}</TableCell>
                                    <TableCell>{loc.description}</TableCell>
                                    <TableCell>
                                        <IconButton onClick={() => handleEdit(loc)}>
                                            <EditIcon />
                                        </IconButton>
                                        <IconButton onClick={() => handleDelete(loc)}>
                                            <DeleteIcon />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Box>
    );
};

export default LocationManagement;