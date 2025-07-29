module.exports = {
  apps: [
    {
      name: 'dbweb-backend',
      script: 'backend/src/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 4001
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 4001
      },
      error_file: './logs/dbweb-backend-error.log',
      out_file: './logs/dbweb-backend-out.log',
      log_file: './logs/dbweb-backend-combined.log',
      time: true
    }
  ]
}; 