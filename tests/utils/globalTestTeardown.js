import { globalTeardown } from './globalTestSetup.js';

const teardown = async () => {
  await globalTeardown();
};

export default teardown;