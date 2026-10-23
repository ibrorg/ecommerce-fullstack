import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: string[] | Record<string, string>;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export const sendSuccess = <T>(
  res: Response,
  statusCode: number,
  data: T,
  message?: string,
  pagination?: ApiResponse['pagination']
): Response => {
  const response: ApiResponse<T> = {
    success: true,
    ...(message && { message }),
    ...(data && { data }),
    ...(pagination && { pagination })
  };
  return res.status(statusCode).json(response);
};

export const sendError = (
  res: Response,
  statusCode: number,
  message: string,
  errors?: string[] | Record<string, string>
): Response => {
  const response: ApiResponse = {
    success: false,
    message,
    ...(errors && { errors })
  };
  return res.status(statusCode).json(response);
};

export const sendValidationError = (
  res: Response,
  errors: string[]
): Response => {
  return sendError(res, 400, 'Validation failed', errors);
};

export const sendPaginatedSuccess = <T>(
  res: Response,
  statusCode: number,
  data: T[],
  page: number,
  limit: number,
  total: number,
  message?: string
): Response => {
  const pages = Math.ceil(total / limit);
  return sendSuccess(res, statusCode, data, message, {
    page,
    limit,
    total,
    pages
  });
};
