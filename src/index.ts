import { config } from './config/env';
import { connectDB } from './config/db';
import app from './app';

async function main(): Promise<void> {
  await connectDB();

  app.listen(config.port, () => {
    console.log(`🚀 Server running on http://localhost:${config.port}`);
    console.log(`📖 API docs: http://localhost:${config.port}/api/docs`);
    console.log(`🌍 Environment: ${config.nodeEnv}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
