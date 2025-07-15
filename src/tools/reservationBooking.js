import axios from 'axios';

export default async function reservationBooking(args, userContext) {
  const { 
    restaurantName, 
    date, 
    time, 
    partySize, 
    specialRequests = '',
    phone = '',
    email = ''
  } = args;

  const { user } = userContext;

  try {
    const reservation = {
      restaurant: restaurantName,
      date: new Date(date),
      time: time,
      partySize: parseInt(partySize),
      customerName: user.profile?.get('name') || user.email,
      customerEmail: email || user.email,
      customerPhone: phone || user.profile?.get('phone') || '',
      specialRequests: specialRequests,
      bookingId: generateBookingId(),
      status: 'pending',
      createdAt: new Date(),
    };

    const result = await simulateBookingAPI(reservation);
    
    if (result.success) {
      await sendConfirmationEmail(reservation, user);
      
      return {
        success: true,
        bookingId: result.bookingId,
        confirmation: result.confirmation,
        message: `Reservation confirmed for ${restaurantName} on ${date} at ${time} for ${partySize} people.`,
        details: {
          restaurant: restaurantName,
          date: date,
          time: time,
          partySize: partySize,
          bookingId: result.bookingId,
          estimatedWaitTime: result.estimatedWaitTime,
        },
      };
    } else {
      return {
        success: false,
        error: result.error || 'Booking failed',
        alternatives: result.alternatives || [],
      };
    }
  } catch (error) {
    console.error('Reservation booking error:', error);
    return {
      success: false,
      error: 'Failed to process reservation booking',
      details: error.message,
    };
  }
}

function generateBookingId() {
  return 'BK' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase();
}

async function simulateBookingAPI(reservation) {
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const isAvailable = Math.random() > 0.3;
  
  if (isAvailable) {
    return {
      success: true,
      bookingId: reservation.bookingId,
      confirmation: `CONF-${reservation.bookingId}`,
      estimatedWaitTime: Math.floor(Math.random() * 30) + 10,
      status: 'confirmed',
    };
  } else {
    const alternatives = [
      { time: '7:00 PM', availability: 'available' },
      { time: '8:30 PM', availability: 'available' },
      { time: '9:00 PM', availability: 'limited' },
    ];
    
    return {
      success: false,
      error: 'Requested time slot not available',
      alternatives: alternatives,
    };
  }
}

async function sendConfirmationEmail(reservation, user) {
  console.log(`[EMAIL] Sending confirmation to ${user.email}`);
  console.log(`[EMAIL] Reservation details:`, reservation);
  
  return true;
}