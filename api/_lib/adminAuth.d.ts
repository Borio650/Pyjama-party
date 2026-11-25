import type { IncomingMessage, ServerResponse } from 'http';

export function getConfiguredEnvPasscode(): string;
export function issueBearerToken(): string;
export function verifyBearerToken(token: string): boolean;
export function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void;
export function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>>;
export function handleHealth(req: IncomingMessage, res: ServerResponse): Promise<void>;
export function handleAuthStatus(req: IncomingMessage, res: ServerResponse): Promise<void>;
export function handleSetup(req: IncomingMessage, res: ServerResponse): Promise<void>;
export function handleLogin(req: IncomingMessage, res: ServerResponse): Promise<void>;
export function handleVerify(req: IncomingMessage, res: ServerResponse): Promise<void>;
