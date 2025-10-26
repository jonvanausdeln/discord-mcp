import { AttachmentBuilder } from 'discord.js';
import { FileAttachment } from '../types/discord.js';
import { Logger } from './logger.js';
import { promises as fs } from 'fs';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

export class FileProcessor {
  private static readonly MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB Discord limit
  private static readonly FETCH_TIMEOUT = 30000; // 30 seconds

  constructor(private logger: Logger) {}

  async processAttachments(files: FileAttachment[]): Promise<AttachmentBuilder[]> {
    if (!files || files.length === 0) {
      return [];
    }

    this.logger.info('Processing file attachments', { count: files.length });

    const attachments = await Promise.all(
      files.map((file, index) => this.processAttachment(file, index))
    );

    this.logger.info('File attachments processed successfully', {
      count: attachments.length
    });

    return attachments;
  }

  private async processAttachment(file: FileAttachment, index: number): Promise<AttachmentBuilder> {
    try {
      this.validateFileAttachment(file);

      let buffer: Buffer;
      const startTime = Date.now();

      if (file.data) {
        buffer = await this.processBase64Data(file.data);
        this.logger.debug('Processed base64 attachment', {
          filename: file.name,
          size: buffer.length,
          processingTime: Date.now() - startTime
        });
      } else if (file.url) {
        buffer = await this.fetchFromUrl(file.url);
        this.logger.debug('Processed URL attachment', {
          filename: file.name,
          url: file.url,
          size: buffer.length,
          processingTime: Date.now() - startTime
        });
      } else if (file.path) {
        buffer = await this.readFromPath(file.path);
        this.logger.debug('Processed file path attachment', {
          filename: file.name,
          path: file.path,
          size: buffer.length,
          processingTime: Date.now() - startTime
        });
      } else {
        throw new Error(`No valid file source provided for attachment ${index}`);
      }

      // Validate file size after processing
      if (buffer.length > FileProcessor.MAX_FILE_SIZE) {
        throw new Error(
          `File "${file.name}" is too large (${this.formatFileSize(buffer.length)}). Maximum size is ${this.formatFileSize(FileProcessor.MAX_FILE_SIZE)}`
        );
      }

      // Create Discord attachment
      const attachmentName = file.spoiler ? `SPOILER_${file.name}` : file.name;
      const attachment = new AttachmentBuilder(buffer, {
        name: attachmentName,
        description: file.description
      });

      return attachment;

    } catch (error) {
      this.logger.error(`Failed to process attachment "${file.name}"`, error instanceof Error ? error : new Error(String(error)));
      throw new Error(`Failed to process attachment "${file.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private validateFileAttachment(file: FileAttachment): void {
    if (!file.name || typeof file.name !== 'string') {
      throw new Error('File attachment must have a valid name');
    }

    const hasDataSource = !!(file.data || file.url || file.path);
    if (!hasDataSource) {
      throw new Error('File attachment must have at least one data source (data, url, or path)');
    }

    const dataSourceCount = [file.data, file.url, file.path].filter(Boolean).length;
    if (dataSourceCount > 1) {
      throw new Error('File attachment must have exactly one data source (data, url, or path)');
    }

    // Validate filename
    if (file.name.length > 100) {
      throw new Error('Filename too long (max 100 characters)');
    }

    // Basic filename validation
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(file.name)) {
      throw new Error('Filename contains invalid characters');
    }
  }

  private async processBase64Data(data: string): Promise<Buffer> {
    try {
      // Handle data URLs (data:image/png;base64,...)
      const base64Data = data.includes(',') ? data.split(',')[1] : data;

      if (!base64Data) {
        throw new Error('Invalid base64 data format');
      }

      const buffer = Buffer.from(base64Data, 'base64');

      if (buffer.length === 0) {
        throw new Error('Base64 data resulted in empty buffer');
      }

      return buffer;
    } catch (error) {
      throw new Error(`Failed to decode base64 data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async fetchFromUrl(url: string): Promise<Buffer> {
    try {
      // Validate URL
      const urlObj = new URL(url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error('Only HTTP and HTTPS URLs are supported');
      }

      this.logger.debug('Fetching file from URL', { url });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FileProcessor.FETCH_TIMEOUT);

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Discord-MCP-Server/1.0'
          }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > FileProcessor.MAX_FILE_SIZE) {
          throw new Error(`File too large (${this.formatFileSize(parseInt(contentLength))}). Maximum size is ${this.formatFileSize(FileProcessor.MAX_FILE_SIZE)}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);

      } finally {
        clearTimeout(timeoutId);
      }

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout while fetching from URL: ${url}`);
      }
      throw new Error(`Failed to fetch from URL "${url}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async readFromPath(filePath: string): Promise<Buffer> {
    try {
      // Basic path validation - prevent directory traversal
      if (filePath.includes('..') || filePath.includes('~')) {
        throw new Error('Path traversal not allowed');
      }

      this.logger.debug('Reading file from path', { path: filePath });

      // Check if file exists and get stats
      const stats = await fs.stat(filePath);

      if (!stats.isFile()) {
        throw new Error('Path does not point to a file');
      }

      if (stats.size > FileProcessor.MAX_FILE_SIZE) {
        throw new Error(`File too large (${this.formatFileSize(stats.size)}). Maximum size is ${this.formatFileSize(FileProcessor.MAX_FILE_SIZE)}`);
      }

      // Read the file
      const buffer = await fs.readFile(filePath);
      return buffer;

    } catch (error) {
      if (error instanceof Error && (error as any).code === 'ENOENT') {
        throw new Error(`File not found: ${filePath}`);
      }
      if (error instanceof Error && (error as any).code === 'EACCES') {
        throw new Error(`Permission denied: ${filePath}`);
      }
      throw new Error(`Failed to read file "${filePath}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private formatFileSize(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  }
}