import { createApp } from './app';
import { loadEnv } from './config/env';

const env = loadEnv();
const app = createApp(env);

app.listen(env.PORT, () => {
  console.log(`AstroCalc API listening on http://localhost:${env.PORT}`);
});
