import type { IncomingMessage, ServerResponse } from 'http';
import { handleHealth } from './_lib/adminAuth.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await handleHealth(req, res);
}
