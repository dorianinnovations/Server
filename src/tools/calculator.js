export default async function calculator(args, _userContext) {
  try {
    const { expression, type = 'basic' } = args;
    
    if (!expression || typeof expression !== 'string') {
      throw new Error('Expression is required and must be a string');
    }

    // Basic math evaluation - secure parsing
    const sanitizedExpression = expression.replace(/[^0-9+\-*/.() ]/g, '');
    
    if (sanitizedExpression !== expression) {
      throw new Error('Invalid characters in expression. Use only numbers and basic operators (+, -, *, /, (, ))');
    }

    let result;
    try {
      // Safe evaluation using Function constructor (limited scope)
      result = Function('"use strict"; return (' + sanitizedExpression + ')')();
    } catch (_evalError) {
      throw new Error('Invalid mathematical expression');
    }

    if (!isFinite(result)) {
      throw new Error('Result is not a finite number');
    }

    return {
      success: true,
      data: {
        expression: expression,
        result: result,
        type: type
      },
      message: `${expression} = ${result}`
    };

  } catch (error) {
    console.error('Calculator error:', error);
    return {
      success: false,
      error: error.message || 'Failed to calculate expression'
    };
  }
}