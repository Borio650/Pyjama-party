import type { IncomingMessage, ServerResponse } from 'http';
import { handleVerify } from '../_lib/adminAuth.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await handleVerify(req, res);
}
