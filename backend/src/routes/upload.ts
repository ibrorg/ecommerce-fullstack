import express, { Response, Request, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { sendSuccess, sendError } from '../utils/response';
import { uploadLimiter, apiLimiter } from '../config/rateLimits';

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

// File filter - allow only images
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'));
  }
};

// Configure multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
    files: 10 // Max 10 files at once
  }
});

/**
 * @route   POST /api/upload
 * @desc    Upload a single image
 * @access  Private
 */
router.post(
  '/',
  uploadLimiter,
  authenticate,
  upload.single('file'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) {
      throw new AppError('No file uploaded', 400, 'NO_FILE');
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    
    return sendSuccess(res, 200, {
      url: fileUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    }, 'File uploaded successfully');
  })
);

/**
 * @route   POST /api/upload/multiple
 * @desc    Upload multiple images
 * @access  Private
 */
router.post(
  '/multiple',
  uploadLimiter,
  authenticate,
  upload.array('files', 10),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      throw new AppError('No files uploaded', 400, 'NO_FILES');
    }

    const uploadedFiles = files.map(file => ({
      url: `/uploads/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype
    }));
    
    return sendSuccess(res, 200, {
      files: uploadedFiles,
      count: uploadedFiles.length
    }, 'Files uploaded successfully');
  })
);

/**
 * @route   DELETE /api/upload/:filename
 * @desc    Delete an uploaded file
 * @access  Private
 */
router.delete(
  '/:filename',
  apiLimiter,
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { filename } = req.params;
    
    // Sanitize filename to prevent directory traversal
    const sanitizedFilename = path.basename(filename);
    const filePath = path.join(uploadsDir, sanitizedFilename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new AppError('File not found', 404, 'FILE_NOT_FOUND');
    }
    
    // Delete the file
    fs.unlinkSync(filePath);
    
    return sendSuccess(res, 200, null, 'File deleted successfully');
  })
);

// Error handling middleware for multer errors
router.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return sendError(res, 400, 'File size exceeds the 5MB limit');
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return sendError(res, 400, 'Too many files. Maximum 10 files allowed');
    }
    return sendError(res, 400, err.message);
  }
  
  if (err.message && err.message.includes('Only image files')) {
    return sendError(res, 400, err.message);
  }
  
  next(err);
});

export default router;