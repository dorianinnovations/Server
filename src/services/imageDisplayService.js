import axios from 'axios';
import sharp from 'sharp';
import { createHash } from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import logger from '../utils/logger.js';

/**
 * Image Display Service
 * Provides image processing and display capabilities for search results
 * and other rich content throughout the application
 */

class ImageDisplayService {
  constructor() {
    this.cacheDir = path.join(process.cwd(), 'cache', 'images');
    this.maxCacheSize = 100 * 1024 * 1024; // 100MB cache limit
    this.supportedFormats = ['jpeg', 'jpg', 'png', 'webp', 'gif'];
    this.maxImageSize = 5 * 1024 * 1024; // 5MB max image size
    
    this.initializeCache();
  }

  async initializeCache() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      logger.info('Image cache directory initialized', { cacheDir: this.cacheDir });
    } catch (error) {
      logger.error('Failed to initialize image cache directory', { error: error.message });
    }
  }

  /**
   * Process and cache an image from a URL
   * @param {string} imageUrl - URL of the image to process
   * @param {Object} options - Processing options
   * @returns {Object} Processed image information
   */
  async processImage(imageUrl, options = {}) {
    const {
      width = 800,
      height = 600,
      quality = 80,
      format = 'webp',
      generateThumbnail = true,
      thumbnailSize = 150
    } = options;

    try {
      // Validate URL
      if (!this.isValidImageUrl(imageUrl)) {
        throw new Error('Invalid image URL provided');
      }

      // Generate cache key
      const cacheKey = this.generateCacheKey(imageUrl, options);
      const cachedImage = await this.getCachedImage(cacheKey);
      
      if (cachedImage) {
        logger.debug('Returning cached image', { imageUrl, cacheKey });
        return cachedImage;
      }

      // Fetch and process image
      const imageBuffer = await this.fetchImage(imageUrl);
      const processedImage = await this.processImageBuffer(imageBuffer, {
        width, height, quality, format, generateThumbnail, thumbnailSize
      });

      // Cache the processed image
      await this.cacheImage(cacheKey, processedImage);

      logger.info('Image processed and cached', { 
        imageUrl, 
        originalSize: imageBuffer.length,
        processedSize: processedImage.main.size,
        format: processedImage.main.format
      });

      return processedImage;

    } catch (error) {
      logger.error('Failed to process image', { 
        imageUrl, 
        error: error.message 
      });
      
      return {
        success: false,
        error: error.message,
        fallbackUrl: this.generateFallbackImage(options)
      };
    }
  }

  /**
   * Extract images from search results and process them
   * @param {Array} searchResults - Array of search results  
   * @returns {Array} Enhanced search results with processed images
   */
  async enhanceSearchResultsWithImages(searchResults) {
    if (!Array.isArray(searchResults)) return searchResults;

    const enhancedResults = await Promise.all(
      searchResults.map(async (result) => {
        try {
          // Look for images in various result properties
          const imageUrl = this.extractImageFromResult(result);
          
          if (imageUrl) {
            const processedImage = await this.processImage(imageUrl, {
              width: 400,
              height: 300,
              generateThumbnail: true,
              thumbnailSize: 120
            });

            if (processedImage.success !== false) {
              result.image = processedImage;
              result.hasImage = true;
            }
          }

          return result;
        } catch (error) {
          logger.warn('Failed to enhance result with image', { 
            resultTitle: result.title,
            error: error.message 
          });
          return result;
        }
      })
    );

    return enhancedResults;
  }

  /**
   * Generate rich media cards for search results
   * @param {Array} searchResults - Search results with images
   * @returns {string} Markdown formatted rich media content
   */
  generateRichMediaMarkdown(searchResults) {
    if (!Array.isArray(searchResults)) return '';

    let markdown = '';

    searchResults.forEach((result, index) => {
      markdown += `### ${index + 1}. ${result.title}\n\n`;

      // Add image if available
      if (result.hasImage && result.image && result.image.main) {
        markdown += `![${result.title}](${result.image.main.url} "${result.title}")\n\n`;
        
        // Add thumbnail for mobile optimization
        if (result.image.thumbnail) {
          markdown += `<details>\n<summary>View thumbnail</summary>\n\n`;
          markdown += `![Thumbnail](${result.image.thumbnail.url} "${result.title} - Thumbnail")\n\n`;
          markdown += `</details>\n\n`;
        }
      }

      // Add content
      if (result.snippet) {
        markdown += `${result.snippet}\n\n`;
      }

      // Add metadata
      markdown += `**Source:** ${result.displayLink || 'Unknown'}\n`;
      if (result.link) {
        markdown += `**Link:** [Visit Page](${result.link})\n`;
      }

      // Add image metadata if available
      if (result.hasImage && result.image) {
        markdown += `**Image:** ${result.image.main.width}x${result.image.main.height} ${result.image.main.format.toUpperCase()}\n`;
      }

      markdown += `\n---\n\n`;
    });

    return markdown.trim();
  }

  /**
   * Private helper methods
   */

  isValidImageUrl(url) {
    try {
      const parsed = new URL(url);
      
      // Only allow HTTP/HTTPS
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return false;
      }

      // Block suspicious domains
      const suspiciousDomains = ['localhost', '127.0.0.1', '0.0.0.0', '10.', '192.168.', '172.'];
      if (suspiciousDomains.some(domain => parsed.hostname.includes(domain))) {
        return false;
      }

      // Check for image-like file extensions
      const pathname = parsed.pathname.toLowerCase();
      const hasImageExtension = this.supportedFormats.some(format => 
        pathname.includes(`.${format}`)
      );

      return hasImageExtension || pathname.includes('image') || pathname.includes('photo');
    } catch {
      return false;
    }
  }

  async fetchImage(imageUrl) {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
      maxContentLength: this.maxImageSize,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Numina-ImageBot/1.0)',
        'Accept': 'image/*'
      }
    });

    if (response.status !== 200) {
      throw new Error(`Failed to fetch image: HTTP ${response.status}`);
    }

    return Buffer.from(response.data);
  }

  async processImageBuffer(imageBuffer, options) {
    const { width, height, quality, format, generateThumbnail, thumbnailSize } = options;

    // Process main image
    const mainImage = await sharp(imageBuffer)
      .resize(width, height, { 
        fit: 'inside', 
        withoutEnlargement: true 
      })
      .toFormat(format, { quality })
      .toBuffer();

    const mainImageInfo = await sharp(mainImage).metadata();

    const result = {
      main: {
        buffer: mainImage,
        size: mainImage.length,
        width: mainImageInfo.width,
        height: mainImageInfo.height,
        format: format,
        url: `data:image/${format};base64,${mainImage.toString('base64')}`
      }
    };

    // Generate thumbnail if requested
    if (generateThumbnail) {
      const thumbnailImage = await sharp(imageBuffer)
        .resize(thumbnailSize, thumbnailSize, { 
          fit: 'cover' 
        })
        .toFormat('webp', { quality: 60 })
        .toBuffer();

      result.thumbnail = {
        buffer: thumbnailImage,
        size: thumbnailImage.length,
        width: thumbnailSize,
        height: thumbnailSize,
        format: 'webp',
        url: `data:image/webp;base64,${thumbnailImage.toString('base64')}`
      };
    }

    return result;
  }

  extractImageFromResult(result) {
    // Try to find image URLs in various result properties
    const possibleImageSources = [
      result.image,
      result.thumbnail,
      result.pagemap?.cse_image?.[0]?.src,
      result.pagemap?.cse_thumbnail?.[0]?.src,
      result.pagemap?.metatags?.[0]?.['og:image'],
      result.pagemap?.metatags?.[0]?.['twitter:image']
    ];

    for (const imageUrl of possibleImageSources) {
      if (imageUrl && this.isValidImageUrl(imageUrl)) {
        return imageUrl;
      }
    }

    return null;
  }

  generateCacheKey(imageUrl, options) {
    const keyData = JSON.stringify({ imageUrl, options });
    return createHash('md5').update(keyData).digest('hex');
  }

  async getCachedImage(cacheKey) {
    try {
      const cachePath = path.join(this.cacheDir, `${cacheKey}.json`);
      const cachedData = await fs.readFile(cachePath, 'utf8');
      const cachedImage = JSON.parse(cachedData);
      
      // Check if cache is still valid (24 hours)
      const cacheAge = Date.now() - cachedImage.timestamp;
      if (cacheAge > 24 * 60 * 60 * 1000) {
        await fs.unlink(cachePath);
        return null;
      }

      return cachedImage.data;
    } catch {
      return null;
    }
  }

  async cacheImage(cacheKey, imageData) {
    try {
      const cachePath = path.join(this.cacheDir, `${cacheKey}.json`);
      const cacheData = {
        timestamp: Date.now(),
        data: imageData
      };
      
      await fs.writeFile(cachePath, JSON.stringify(cacheData));
    } catch (error) {
      logger.warn('Failed to cache image', { cacheKey, error: error.message });
    }
  }

  generateFallbackImage(options = {}) {
    const { width = 400, height = 300 } = options;
    return `data:image/svg+xml;base64,${Buffer.from(`
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f0f0f0"/>
        <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#999">
          Image not available
        </text>
      </svg>
    `).toString('base64')}`;
  }

  /**
   * Clean up old cache files
   */
  async cleanupCache() {
    try {
      const files = await fs.readdir(this.cacheDir);
      const now = Date.now();
      
      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        const stats = await fs.stat(filePath);
        
        // Remove files older than 7 days
        if (now - stats.mtime.getTime() > 7 * 24 * 60 * 60 * 1000) {
          await fs.unlink(filePath);
        }
      }
      
      logger.info('Image cache cleanup completed');
    } catch (error) {
      logger.error('Failed to cleanup image cache', { error: error.message });
    }
  }
}

// Singleton instance
const imageDisplayService = new ImageDisplayService();

// Schedule cache cleanup every 6 hours
setInterval(() => {
  imageDisplayService.cleanupCache();
}, 6 * 60 * 60 * 1000);

export default imageDisplayService;