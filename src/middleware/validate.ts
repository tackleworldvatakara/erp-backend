import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validate(schema: ZodSchema): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const error = Object.assign(new Error('Validation failed'), {
        statusCode: 422,
        errors: (result.error as ZodError).errors,
      });
      return next(error);
    }
    req.body = result.data;
    next();
  };
}
