import React, { useState, useEffect } from 'react';
import axios from 'axios';

const BOMSyncDashboard = () => {
  const [syncStatus, setSyncStatus] = useState({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [centralData, setCentralData] = useState([]);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  useEffect(() => {
    fetchSyncStatus();
    fetchCentralData();
  }, []);

  const fetchSyncStatus = async () => {
    try {
      const response = await axios.get('/api/sync/status');
      setSyncStatus(response.data.data);
    } catch (error) {
      console.error('Error fetching sync status:', error);
    }
  };

  const fetchCentralData = async () => {
    try {
      const response = await axios.get('/api/sync/bom/central-data');
      setCentralData(response.data.data);
    } catch (error) {
      console.error('Error fetching central data:', error);
    }
  };

  const triggerBOMSync = async () => {
    setIsSyncing(true);
    try {
      const response = await axios.post('/api/sync/bom');
      setLastSyncTime(new Date());
      await fetchSyncStatus();
      alert('BOM sync completed successfully!');
    } catch (error) {
      console.error('Error triggering BOM sync:', error);
      alert('BOM sync failed: ' + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const triggerMachineSync = async (machineName) => {
    setIsSyncing(true);
    try {
      const response = await axios.post(`/api/sync/bom/${encodeURIComponent(machineName)}`);
      setLastSyncTime(new Date());
      await fetchSyncStatus();
      alert(`BOM sync to ${machineName} completed successfully!`);
    } catch (error) {
      console.error(`Error triggering BOM sync to ${machineName}:`, error);
      alert(`BOM sync to ${machineName} failed: ` + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="bom-sync-dashboard">
      <h2>BOM Data Synchronization Dashboard</h2>
      
      {/* Sync Controls */}
      <div className="sync-controls">
        <h3>Manual Sync Controls</h3>
        <div className="button-group">
          <button 
            onClick={triggerBOMSync}
            disabled={isSyncing}
            className="sync-button"
          >
            {isSyncing ? 'Syncing...' : 'Sync BOM to All Machines'}
          </button>
        </div>
        {lastSyncTime && (
          <p className="last-sync">
            Last sync: {lastSyncTime.toLocaleString()}
          </p>
        )}
      </div>

      {/* Central Data Info */}
      <div className="central-data-info">
        <h3>Central Database Info</h3>
        <p>Total BOM records: {centralData.length}</p>
        <p>Database: PP_OCP (192.168.100.222)</p>
        <p>Table: tbl_check_p</p>
      </div>

      {/* Machine Status */}
      <div className="machine-status">
        <h3>Machine Sync Status</h3>
        <div className="status-grid">
          {Object.entries(syncStatus).map(([machine, status]) => (
            <div key={machine} className={`status-card ${status.status.toLowerCase()}`}>
              <h4>{machine}</h4>
              <p>Status: {status.status}</p>
              <p>Online: {status.online ? 'Yes' : 'No'}</p>
              {status.lastSync && (
                <p>Last Sync: {new Date(status.lastSync).toLocaleString()}</p>
              )}
              {status.error && (
                <p className="error">Error: {status.error}</p>
              )}
              <button 
                onClick={() => triggerMachineSync(machine)}
                disabled={isSyncing || !status.online}
                className="sync-machine-button"
              >
                Sync to {machine}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Sync Progress */}
      {isSyncing && (
        <div className="sync-progress">
          <div className="progress-bar">
            <div className="progress-fill"></div>
          </div>
          <p>Syncing BOM data from Central Database to Local Machines...</p>
        </div>
      )}

      <style jsx>{`
        .bom-sync-dashboard {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .sync-controls {
          background: #f5f5f5;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .button-group {
          margin: 15px 0;
        }

        .sync-button {
          background: #007bff;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
        }

        .sync-button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .last-sync {
          color: #666;
          font-style: italic;
        }

        .central-data-info {
          background: #e8f4fd;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .machine-status {
          margin-top: 20px;
        }

        .status-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
          margin-top: 15px;
        }

        .status-card {
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 15px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .status-card.online {
          border-left: 4px solid #28a745;
        }

        .status-card.offline {
          border-left: 4px solid #dc3545;
        }

        .status-card.error {
          border-left: 4px solid #ffc107;
        }

        .status-card h4 {
          margin: 0 0 10px 0;
          color: #333;
        }

        .status-card p {
          margin: 5px 0;
          color: #666;
        }

        .status-card .error {
          color: #dc3545;
          font-weight: bold;
        }

        .sync-machine-button {
          background: #28a745;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          margin-top: 10px;
          font-size: 14px;
        }

        .sync-machine-button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .sync-progress {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: white;
          padding: 30px;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          text-align: center;
          z-index: 1000;
        }

        .progress-bar {
          width: 300px;
          height: 20px;
          background: #f0f0f0;
          border-radius: 10px;
          overflow: hidden;
          margin: 20px 0;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #007bff, #0056b3);
          animation: progress 2s ease-in-out infinite;
        }

        @keyframes progress {
          0% { width: 0%; }
          50% { width: 70%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  );
};

export default BOMSyncDashboard;
