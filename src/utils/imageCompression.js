import sharp from 'sharp';

/**
 * Intelligent image compression utility for memory optimization
 * Reduces API costs by creating efficient thumbnails while preserving full images when needed
 */

/**
 * Compress base64 image to thumbnail for memory storage
 * @param {string} base64Data - Full base64 image data
 * @param {object} options - Compression options
 * @returns {Promise<object>} Compressed image data with metadata
 */
// Image compression cache to avoid recompressing the same images
const compressionCache = new Map();
const MAX_COMPRESSION_CACHE_SIZE = 100;

// Helper to generate cache key for image
function getImageCacheKey(base64Data, options) {
  const imageHash = base64Data.substring(0, 100); // Use first 100 chars as hash
  return `${imageHash}_${options.thumbnailWidth || 256}_${options.quality || 60}`;
}

export const compressImageForMemory = async (base64Data, options = {}) => {
  const {
    thumbnailWidth = 256,
    thumbnailHeight = 256,
    quality = 60,
    format = 'jpeg',
    skipCache = false
  } = options;

  try {
    // Check cache first (unless explicitly skipped)
    if (!skipCache) {
      const cacheKey = getImageCacheKey(base64Data, options);
      const cached = compressionCache.get(cacheKey);
      if (cached) {
        console.log(`⚡ IMAGE CACHE HIT: Using cached compression`);
        return cached;
      }
    }

    // Extract format and data from base64 string
    const matches = base64Data.match(/^data:image\/([a-zA-Z]*);base64,(.*)$/);
    if (!matches) {
      throw new Error('Invalid base64 image format');
    }

    const [, originalFormat, imageData] = matches;
    const buffer = Buffer.from(imageData, 'base64');

    // Get original image metadata (with timeout for performance)
    const metadataPromise = sharp(buffer).metadata();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Metadata extraction timeout')), 5000)
    );
    
    const metadata = await Promise.race([metadataPromise, timeoutPromise]);
    const originalSize = buffer.length;

    // Skip compression if image is already small enough
    if (originalSize < 50000 && metadata.width <= thumbnailWidth && metadata.height <= thumbnailHeight) {
      console.log(`📐 IMAGE SKIP: Image already optimal size (${originalSize} bytes)`);
      const result = {
        original: {
          url: base64Data,
          size: originalSize,
          width: metadata.width,
          height: metadata.height,
          format: originalFormat
        },
        thumbnail: {
          url: base64Data, // Use original as thumbnail
          size: originalSize,
          width: metadata.width,
          height: metadata.height,
          format: originalFormat,
          quality
        },
        metadata: {
          compressionRatio: 1,
          sizeSaved: 0,
          timestamp: new Date().toISOString(),
          skipped: true
        }
      };
      
      // Cache the result
      if (!skipCache) {
        const cacheKey = getImageCacheKey(base64Data, options);
        if (compressionCache.size >= MAX_COMPRESSION_CACHE_SIZE) {
          // Remove oldest entry
          const firstKey = compressionCache.keys().next().value;
          compressionCache.delete(firstKey);
        }
        compressionCache.set(cacheKey, result);
      }
      
      return result;
    }

    // Create compressed thumbnail with optimized settings
    const compressionStart = process.hrtime.bigint();
    const compressed = await sharp(buffer)
      .resize(thumbnailWidth, thumbnailHeight, {
        fit: 'inside',
        withoutEnlargement: true,
        kernel: sharp.kernel.lanczos2 // Faster kernel
      })
      .jpeg({ 
        quality,
        progressive: false, // Disable progressive for speed
        mozjpeg: true // Use mozjpeg for better compression
      })
      .toBuffer();
    
    const compressionTime = Number(process.hrtime.bigint() - compressionStart) / 1000000;
    const compressedBase64 = `data:image/${format};base64,${compressed.toString('base64')}`;
    const compressionRatio = originalSize / compressed.length;

    console.log(`🗜️ IMAGE COMPRESSION: ${originalSize} → ${compressed.length} bytes (${compressionRatio.toFixed(1)}x reduction) in ${compressionTime.toFixed(1)}ms`);

    const result = {
      original: {
        url: base64Data,
        size: originalSize,
        width: metadata.width,
        height: metadata.height,
        format: originalFormat
      },
      thumbnail: {
        url: compressedBase64,
        size: compressed.length,
        width: thumbnailWidth,
        height: thumbnailHeight,
        format,
        quality
      },
      metadata: {
        compressionRatio,
        sizeSaved: originalSize - compressed.length,
        timestamp: new Date().toISOString(),
        compressionTime: compressionTime.toFixed(1) + 'ms'
      }
    };
    
    // Cache the result for future use
    if (!skipCache) {
      const cacheKey = getImageCacheKey(base64Data, options);
      if (compressionCache.size >= MAX_COMPRESSION_CACHE_SIZE) {
        // Remove oldest entry (LRU-style)
        const firstKey = compressionCache.keys().next().value;
        compressionCache.delete(firstKey);
      }
      compressionCache.set(cacheKey, result);
    }
    
    return result;
  } catch (error) {
    console.error('❌ IMAGE COMPRESSION: Error compressing image:', error);
    throw new Error(`Image compression failed: ${error.message}`);
  }
};

/**
 * Smart image selection for API requests
 * Uses thumbnails for context, full images only when specifically needed
 * @param {Array} attachments - Array of image attachments
 * @param {string} userPrompt - User's message text
 * @param {object} options - Selection options
 * @returns {Array} Optimized attachments for API
 */
export const selectOptimalImagesForAPI = (attachments, userPrompt, options = {}) => {
  const {
    maxImages = 4,
    useFullResolution = false,
    detectionKeywords = ['analyze', 'detail', 'read', 'text', 'examine', 'precise', 'ocr', 'document'],
    smartSelection = true // Enable intelligent size-based selection
  } = options;

  if (!attachments || !attachments.length) {
    return [];
  }

  // Detect if user needs high-resolution analysis
  const promptLower = userPrompt.toLowerCase();
  const needsFullResolution = useFullResolution || 
    detectionKeywords.some(keyword => promptLower.includes(keyword));

  console.log(`🎯 IMAGE SELECTION: ${needsFullResolution ? 'Full resolution' : 'Thumbnail'} mode for ${attachments.length} images`);

  // Sort attachments by importance (smaller images first for thumbnails, larger for full res)
  let sortedAttachments = attachments;
  if (smartSelection && attachments.length > maxImages) {
    sortedAttachments = attachments.sort((a, b) => {
      const aSize = a.compressed?.original.size || a.url?.length || 0;
      const bSize = b.compressed?.original.size || b.url?.length || 0;
      
      // For full resolution, prefer larger images (more detail)
      // For thumbnails, prefer smaller images (less processing)
      return needsFullResolution ? bSize - aSize : aSize - bSize;
    });
  }

  return sortedAttachments.slice(0, maxImages).map((attachment, index) => {
    // Calculate processing priority
    const priority = maxImages - index;
    
    if (attachment.compressed && !needsFullResolution) {
      // Use thumbnail for general conversation
      return {
        ...attachment,
        url: attachment.compressed.thumbnail.url,
        type: 'image',
        resolution: 'thumbnail',
        originalSize: attachment.compressed.original.size,
        currentSize: attachment.compressed.thumbnail.size,
        priority,
        compressionRatio: attachment.compressed.metadata.compressionRatio
      };
    } else {
      // Use full resolution for detailed analysis or if no compression available
      const currentSize = attachment.compressed?.original.size || attachment.url?.length || 0;
      return {
        ...attachment,
        resolution: 'full',
        currentSize,
        priority,
        // Use compressed version if available but still need full res
        url: needsFullResolution && attachment.compressed ? 
          attachment.compressed.original.url : attachment.url
      };
    }
  });
};

/**
 * Calculate memory usage and cost estimates
 * @param {Array} attachments - Image attachments
 * @param {number} messagesCount - Number of messages in context
 * @returns {object} Usage statistics
 */
export const calculateMemoryUsage = (attachments, messagesCount = 50) => {
  if (!attachments || !attachments.length) {
    return { totalSize: 0, estimatedTokens: 0, estimatedCost: 0 };
  }

  const totalSize = attachments.reduce((sum, att) => {
    return sum + (att.currentSize || att.url?.length || 0);
  }, 0);

  // Rough token estimation for images (GPT-4V uses ~765 tokens per image at auto detail)
  const estimatedTokensPerImage = 765;
  const estimatedTokens = attachments.length * estimatedTokensPerImage;
  
  // OpenRouter pricing estimate (GPT-4V: ~$0.01 per 1K tokens)
  const estimatedCost = (estimatedTokens / 1000) * 0.01 * messagesCount;

  return {
    totalSize,
    estimatedTokens,
    estimatedCost: parseFloat(estimatedCost.toFixed(4)),
    imagesCount: attachments.length,
    messagesContext: messagesCount
  };
};

/**
 * Check for duplicate images in conversation history
 * @param {object} newAttachment - New image to check
 * @param {Array} existingAttachments - Previous attachments in conversation
 * @returns {object|null} Existing attachment if duplicate found, null otherwise
 */
export const findDuplicateImage = (newAttachment, existingAttachments) => {
  if (!newAttachment || !newAttachment.url || !existingAttachments.length) {
    return null;
  }

  // Calculate simple hash for comparison (first 100 chars of base64)
  const getImageHash = (base64Url) => {
    const matches = base64Url.match(/^data:image\/[a-zA-Z]*;base64,(.*)$/);
    if (!matches) return null;
    return matches[1].substring(0, 100); // First 100 chars as hash
  };

  const newHash = getImageHash(newAttachment.url);
  if (!newHash) return null;

  return existingAttachments.find(existing => {
    if (!existing.url) return false;
    const existingHash = getImageHash(existing.url);
    return existingHash === newHash;
  }) || null;
};

/**
 * Deduplicate images in memory context
 * @param {Array} memories - Array of memory entries with attachments
 * @returns {Array} Deduplicated memories with image references
 */
export const deduplicateImagesInMemory = (memories) => {
  if (!memories || !memories.length) return memories;

  const imagesSeen = new Set();
  const processedMemories = [];

  for (const memory of memories) {
    if (!memory.attachments || !memory.attachments.length) {
      processedMemories.push(memory);
      continue;
    }

    const deduplicatedAttachments = [];
    
    for (const attachment of memory.attachments) {
      if (attachment.type !== 'image' || !attachment.url) {
        deduplicatedAttachments.push(attachment);
        continue;
      }

      // Create simple hash for deduplication
      const matches = attachment.url.match(/^data:image\/[a-zA-Z]*;base64,(.*)$/);
      if (!matches) {
        deduplicatedAttachments.push(attachment);
        continue;
      }

      const imageHash = matches[1].substring(0, 100);
      
      if (imagesSeen.has(imageHash)) {
        // Replace with reference to avoid sending duplicate
        deduplicatedAttachments.push({
          ...attachment,
          isDuplicate: true,
          url: null, // Remove actual image data
          originalUrl: attachment.url,
          deduplicationHash: imageHash
        });
        console.log(`🔄 IMAGE DEDUPLICATION: Found duplicate image, replaced with reference`);
      } else {
        imagesSeen.add(imageHash);
        deduplicatedAttachments.push(attachment);
      }
    }

    processedMemories.push({
      ...memory,
      attachments: deduplicatedAttachments
    });
  }

  return processedMemories;
};

/**
 * Process attachments for optimal memory storage
 * @param {Array} attachments - Raw attachments from user
 * @returns {Promise<Array>} Processed attachments with compression
 */
export const processAttachmentsForStorage = async (attachments) => {
  if (!attachments || !attachments.length) {
    return [];
  }

  const processed = [];

  for (const attachment of attachments) {
    if (attachment.type === 'image' && attachment.url && attachment.url.startsWith('data:image')) {
      try {
        const compressed = await compressImageForMemory(attachment.url);
        processed.push({
          ...attachment,
          compressed,
          // Store only thumbnail in memory by default
          url: compressed.thumbnail.url,
          originalUrl: compressed.original.url,
          compressionRatio: compressed.metadata.compressionRatio
        });
      } catch (error) {
        console.error('❌ Failed to compress attachment:', error);
        // Keep original if compression fails
        processed.push(attachment);
      }
    } else {
      processed.push(attachment);
    }
  }

  return processed;
};