import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { TokenService } from './tokens';
import { AuthenticationRequiredError } from './errors';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by `requireAuth` once the access token has been verified. */
      userId?: string;
    }
  }
}

/**
 * Express middleware guarding protected routes: reads `Authorization: Bearer
 * <accessToken>`, verifies it via {@link TokenService.verifyAccessToken}, and
 * attaches the resulting `userId` to the request. Missing/malformed headers
 * are rejected the same way an invalid token is — as a 401 — so callers can't
 * distinguish "no token" from "bad token".
 */
export function requireAuth(tokenService: TokenService): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const token = readBearer(req.headers.authorization);
      if (!token) throw new AuthenticationRequiredError();
      const claims = tokenService.verifyAccessToken(token);
      req.userId = claims.userId;
      next();
    } catch (err) {
      next(err);
    }
  };
}

function readBearer(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer (.+)$/.exec(header);
  return match?.[1]?.trim() ?? null;
}
