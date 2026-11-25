import type { IncomingMessage, ServerResponse } from 'http';
import { handleAuthStatus } from '../_lib/adminAuth.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await handleAuthStatus(req, res);
}
