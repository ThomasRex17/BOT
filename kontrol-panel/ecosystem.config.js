module.exports = {
    apps: [
      {
        name: 'mrpd-fronted',
        cwd: 'C:\\Users\\Administrator\\Desktop\\mrpd-fronted',
        script: 'server.js',
        autorestart: true,
        watch: false,
      },
      {
        name: 'mrpd-backend',
        cwd: 'C:\\Users\\Administrator\\Desktop\\mrpd-backend',
        script: 'server.js',
        autorestart: true,
        watch: false,
      },
      {
        name: 'discord-bot',
        cwd: 'C:\\Users\\Administrator\\Downloads\\Bot\\BOT',
        script: 'index.js',
        autorestart: true,
        watch: false,
      },
      {
        name: 'kontrol-panel',
        cwd: 'C:\\Users\\Administrator\\Desktop\\kontrol-panel',
        script: 'server.js',
        autorestart: true,
        watch: false,
      },
    ],
  };