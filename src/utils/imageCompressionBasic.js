/**
 * Basic image compression utility without Sharp dependency
 * Optimizes memory pipeline for cost reduction while maintaining functionality
 */

/**
 * Simple image analysis and optimization for memory storage
 * @param {string} base64Data - Full base64 image data
 * @param {object} options - Compression options
 * @returns {Promise<object>} Processed image data with metadata
 */
export const processImageForMemory = async (base64Data, options = {}) => {
  const {
    maxSize = 1024 * 1024, // 1MB limit for storage
  } = options;

  try {
    // Extract format and data from base64 string
    const matches = base64Data.match(/^data:image\/([a-zA-Z]*);base64,(.*)$/);
    if (!matches) {
      throw new Error('Invalid base64 image format');
    }

    const [, originalFormat, imageData] = matches;
    const buffer = Buffer.from(imageData, 'base64');
    const originalSize = buffer.length;

    // Simple size-based processing - if too large, create a reference
    if (originalSize > maxSize) {
      console.log(`🗜️ IMAGE OPTIMIZATION: Large image (${originalSize} bytes) - creating storage reference`);
      
      // Create a lightweight thumbnail reference (first 1000 chars for quick preview)
      const previewData = imageData.substring(0, 1000);
      const thumbnailBase64 = `data:image/${originalFormat};base64,${previewData}`;
      
      return {
        original: {
          url: base64Data,
          size: originalSize,
          format: originalFormat,
          stored: false // Too large to store efficiently
        },
        thumbnail: {
          url: thumbnailBase64,
          size: previewData.length,
          format: originalFormat,
          isPreview: true
        },
        metadata: {
          compressionRatio: originalSize / previewData.length,
          sizeSaved: originalSize - previewData.length,
          optimizationType: 'preview-reference',
          timestamp: new Date().toISOString()
        }
      };
    } else {
      // Small enough to store directly
      console.log(`💾 IMAGE OPTIMIZATION: Small image (${originalSize} bytes) - storing directly`);
      
      return {
        original: {
          url: base64Data,
          size: originalSize,
          format: originalFormat,
          stored: true
        },
        thumbnail: {
          url: base64Data, // Same as original for small images
          size: originalSize,
          format: originalFormat,
          isPreview: false
        },
        metadata: {
          compressionRatio: 1,
          sizeSaved: 0,
          optimizationType: 'direct-storage',
          timestamp: new Date().toISOString()
        }
      };
    }
  } catch (error) {
    console.error('❌ IMAGE OPTIMIZATION: Error processing image:', error);
    throw new Error(`Image processing failed: ${error.message}`);
  }
};

/**
 * Smart image selection for API requests
 * Uses efficient images for context, full images only when specifically needed
 * @param {Array} attachments - Array of image attachments
 * @param {string} userPrompt - User's message text
 * @param {object} options - Selection options
 * @returns {Array} Optimized attachments for API
 */
export const selectOptimalImagesForAPI = (attachments, userPrompt, options = {}) => {
  const {
    maxImages = 4,
    useFullResolution = false,
    detectionKeywords = ['analyze', 'detail', 'read', 'text', 'examine', 'precise', 'specific', 'identify']
  } = options;

  if (!attachments || !attachments.length) {
    return [];
  }

  // Detect if user needs high-resolution analysis
  const needsFullResolution = useFullResolution || 
    detectionKeywords.some(keyword => 
      userPrompt.toLowerCase().includes(keyword)
    );

  console.log(`🎯 IMAGE SELECTION: ${needsFullResolution ? 'Full resolution' : 'Optimized'} mode for ${attachments.length} images`);

  return attachments.slice(0, maxImages).map(attachment => {
    if (attachment.compressed && !needsFullResolution) {
      // Use thumbnail for general conversation
      return {
        ...attachment,
        url: attachment.compressed.thumbnail.url,
        type: 'image',
        resolution: 'optimized',
        originalSize: attachment.compressed.original.size,
        currentSize: attachment.compressed.thumbnail.size
      };
    } else {
      // Use full resolution for detailed analysis or if no compression available
      return {
        ...attachment,
        resolution: 'full',
        currentSize: attachment.compressed?.original.size || attachment.url?.length || 0
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
 * @returns {Promise<Array>} Processed attachments with optimization
 */
export const processAttachmentsForStorage = async (attachments) => {
  if (!attachments || !attachments.length) {
    return [];
  }

  const processed = [];

  for (const attachment of attachments) {
    if (attachment.type === 'image' && attachment.url && attachment.url.startsWith('data:image')) {
      try {
        const optimized = await processImageForMemory(attachment.url);
        processed.push({
          ...attachment,
          compressed: optimized,
          // Store optimized version in memory
          url: optimized.thumbnail.url,
          originalUrl: optimized.original.url,
          optimizationRatio: optimized.metadata.compressionRatio
        });
      } catch (error) {
        console.error('❌ Failed to optimize attachment:', error);
        // Keep original if optimization fails
        processed.push(attachment);
      }
    } else {
      processed.push(attachment);
    }
  }

  return processed;
};