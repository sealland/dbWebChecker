import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import reportWebVitals from './reportWebVitals';
// เพิ่ม BrowserRouter
import BOMSyncDashboard from './components/BOMSyncDashboard';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import CheckPForm from './components/CheckPForm';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/dashboard" element={<App />} />
        <Route path="/bom-sync" element={<BOMSyncDashboard />} />
        <Route path="/sync-check-p" element={<BOMSyncDashboard />} />
        <Route path="/check-p/new" element={<CheckPForm />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://cra.link/PWA
serviceWorkerRegistration.unregister();

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
