export default async function timezoneConverter(args, userContext) {
  try {
    const { time, fromTimezone, toTimezone, date } = args;
    
    if (!time || !fromTimezone || !toTimezone) {
      throw new Error('Time, fromTimezone, and toTimezone are required');
    }

    // Create date object
    const inputDate = date ? new Date(date + ' ' + time) : new Date();
    
    // Simple timezone conversion using Intl API
    const options = {
      timeZone: toTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    };

    const convertedTime = inputDate.toLocaleString('en-US', options);
    
    return {
      success: true,
      data: {
        originalTime: time,
        originalDate: date,
        fromTimezone: fromTimezone,
        toTimezone: toTimezone,
        convertedTime: convertedTime,
        convertedDateTime: new Date(convertedTime).toISOString()
      },
      message: `${time} ${fromTimezone} = ${convertedTime} ${toTimezone}`
    };

  } catch (error) {
    console.error('Timezone converter error:', error);
    return {
      success: false,
      error: error.message || 'Failed to convert timezone'
    };
  }
}