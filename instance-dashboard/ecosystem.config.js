module.exports = {
  apps: [
    {
      name: 'instance-dashboard',
      script: 'serve',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 4002,
        PM2_SERVE_PATH: './build',
        PM2_SERVE_PORT: 4002,
        PM2_SERVE_SPA: 'true',
        PM2_SERVE_HOMEPAGE: '/index.html'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 4002,
        PM2_SERVE_PATH: './build',
        PM2_SERVE_PORT: 4002,
        PM2_SERVE_SPA: 'true',
        PM2_SERVE_HOMEPAGE: '/index.html'
      },
      error_file: './logs/instance-dashboard-error.log',
      out_file: './logs/instance-dashboard-out.log',
      log_file: './logs/instance-dashboard-combined.log',
      time: true
    }
  ]
}; 