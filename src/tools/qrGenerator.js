export default async function qrGenerator(args, _userContext) {
  try {
    const { content, type = 'text', size = 'medium' } = args;
    
    if (!content || typeof content !== 'string') {
      throw new Error('Content is required and must be a string');
    }

    // Format content based on type
    let formattedContent = content;
    
    if (type === 'url' && !content.startsWith('http')) {
      formattedContent = 'https://' + content;
    } else if (type === 'email') {
      formattedContent = 'mailto:' + content;
    } else if (type === 'phone') {
      formattedContent = 'tel:' + content.replace(/[^+\d]/g, '');
    }

    // Generate QR code URLs using public APIs
    const sizeMap = { small: '150x150', medium: '200x200', large: '300x300' };
    const qrSize = sizeMap[size] || sizeMap.medium;
    
    const qrUrls = [
      {
        service: 'QR Server',
        url: `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}&data=${encodeURIComponent(formattedContent)}`,
        downloadUrl: `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}&format=png&download=1&data=${encodeURIComponent(formattedContent)}`
      },
      {
        service: 'QuickChart',
        url: `https://quickchart.io/qr?text=${encodeURIComponent(formattedContent)}&size=${qrSize.split('x')[0]}`,
        downloadUrl: `https://quickchart.io/qr?text=${encodeURIComponent(formattedContent)}&size=${qrSize.split('x')[0]}&download=1`
      }
    ];

    return {
      success: true,
      data: {
        content: formattedContent,
        originalContent: content,
        type: type,
        size: size,
        qrCodes: qrUrls,
        instructions: [
          'Click any URL to view the QR code',
          'Use downloadUrl to save the QR code as PNG',
          'QR codes work with any QR scanner app'
        ]
      },
      message: `Generated QR code for ${type}: "${content}"`
    };

  } catch (error) {
    console.error('QR generator error:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate QR code'
    };
  }
}