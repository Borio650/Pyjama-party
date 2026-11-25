import type { IncomingMessage, ServerResponse } from 'http';
import { handleLogin } from '../_lib/adminAuth.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await handleLogin(req, res);
}
