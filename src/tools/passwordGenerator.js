export default async function passwordGenerator(args, _userContext) {
  try {
    const { 
      action = 'generate', 
      length = 16, 
      includeSymbols = true, 
      includeNumbers = true,
      password 
    } = args;

    if (action === 'generate') {
      return generatePassword(length, includeSymbols, includeNumbers);
    } else if (action === 'check_strength') {
      if (!password) {
        throw new Error('Password is required for strength checking');
      }
      return checkPasswordStrength(password);
    } else {
      throw new Error('Invalid action. Use "generate" or "check_strength"');
    }

  } catch (error) {
    console.error('Password generator error:', error);
    return {
      success: false,
      error: error.message || 'Failed to process password request'
    };
  }
}

function generatePassword(length, includeSymbols, includeNumbers) {
  if (length < 8 || length > 64) {
    throw new Error('Password length must be between 8 and 64 characters');
  }

  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  let charset = lowercase + uppercase;
  if (includeNumbers) charset += numbers;
  if (includeSymbols) charset += symbols;

  let password = '';
  
  // Ensure at least one character from each required set
  password += getRandomChar(lowercase);
  password += getRandomChar(uppercase);
  if (includeNumbers) password += getRandomChar(numbers);
  if (includeSymbols) password += getRandomChar(symbols);

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += getRandomChar(charset);
  }

  // Shuffle the password
  password = password.split('').sort(() => Math.random() - 0.5).join('');

  const strength = checkPasswordStrength(password);

  return {
    success: true,
    data: {
      password: password,
      length: length,
      includeSymbols: includeSymbols,
      includeNumbers: includeNumbers,
      strength: strength.data
    },
    message: `Generated ${length}-character password with ${strength.data.score}/5 strength`
  };
}

function checkPasswordStrength(password) {
  let score = 0;
  let feedback = [];

  // Length check
  if (password.length >= 8) score += 1;
  else feedback.push('Use at least 8 characters');

  if (password.length >= 12) score += 1;
  else if (password.length >= 8) feedback.push('Consider using 12+ characters for better security');

  // Character variety checks
  if (/[a-z]/.test(password)) score += 1;
  else feedback.push('Add lowercase letters');

  if (/[A-Z]/.test(password)) score += 1;
  else feedback.push('Add uppercase letters');

  if (/\d/.test(password)) score += 1;
  else feedback.push('Add numbers');

  if (/[^a-zA-Z\d]/.test(password)) score += 1;
  else feedback.push('Add special characters');

  // Reduce score for common patterns
  if (/(.)\1{2,}/.test(password)) {
    score -= 1;
    feedback.push('Avoid repeating characters');
  }

  if (/123|abc|qwe|password|admin/.test(password.toLowerCase())) {
    score -= 2;
    feedback.push('Avoid common patterns and words');
  }

  score = Math.max(0, Math.min(5, score));

  const strengthLevels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthLevel = strengthLevels[Math.min(score, 4)];

  return {
    success: true,
    data: {
      password: password,
      score: score,
      maxScore: 5,
      strength: strengthLevel,
      feedback: feedback,
      isSecure: score >= 4
    },
    message: `Password strength: ${strengthLevel} (${score}/5)`
  };
}

function getRandomChar(charset) {
  return charset.charAt(Math.floor(Math.random() * charset.length));
}