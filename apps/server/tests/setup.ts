// 测试环境变量：必须在任何模块（含 prisma client）加载前设置
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST ?? 'mysql://root:123456@127.0.0.1:3309/pomodoro_test'
process.env.JWT_SECRET = 'test-secret'
process.env.CLIENT_ORIGIN = 'http://localhost:5173'
