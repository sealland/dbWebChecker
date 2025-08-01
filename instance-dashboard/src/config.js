// API Configuration
const API_CONFIG = {
  // Development environment
  development: {
    baseUrl: 'http://localhost:4001',
    apiEndpoints: {
      instances: '/api/instances',
      cardData: '/api/instances/card-data',
      finishGoods: '/api/instances/finish-goods',
      productionPlan: '/api/instances/production-plan',
      compare: {
        both: '/api/compare/both',
        update: '/api/compare/update'
      }
    }
  },
  // Production environment
  production: {
    baseUrl: '', // ใช้ relative URL
    apiEndpoints: {
      instances: '/api/instances',
      cardData: '/api/instances/card-data',
      finishGoods: '/api/instances/finish-goods',
      productionPlan: '/api/instances/production-plan',
      compare: {
        both: '/api/compare/both',
        update: '/api/compare/update'
      }
    }
  }
};

// ฟังก์ชันสำหรับดึง API URL
export const getApiUrl = (endpoint) => {
  const env = process.env.NODE_ENV || 'development';
  const config = API_CONFIG[env];
  
  // ใช้ environment variable ถ้ามี
  const baseUrl = process.env.REACT_APP_API_BASE_URL || config.baseUrl;
  return `${baseUrl}${endpoint}`;
};

// ฟังก์ชันสำหรับดึง API endpoints
export const getApiEndpoints = () => {
  const env = process.env.NODE_ENV || 'development';
  return API_CONFIG[env].apiEndpoints;
};

// ฟังก์ชันสำหรับดึง base URL
export const getBaseUrl = () => {
  const env = process.env.NODE_ENV || 'development';
  return API_CONFIG[env].baseUrl;
};

export default API_CONFIG; 