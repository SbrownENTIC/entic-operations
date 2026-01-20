export const formatDateToEST = (dateString, options = {}) => {
  if (!dateString) return '-';
  try {
    // If exact date string YYYY-MM-DD, treat as noon UTC to avoid timezone shift to previous day
    let parseString = dateString;
    if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      parseString = `${dateString}T12:00:00Z`;
    }

    const date = new Date(parseString);
    if (isNaN(date.getTime())) {
        return dateString;
    }
    
    // Default options for MMM d, yyyy (e.g., "Jan 5, 2026")
    const defaultOptions = {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    };

    return date.toLocaleDateString('en-US', { ...defaultOptions, ...options });
  } catch (error) {
    console.warn("Date formatting error:", error);
    return dateString;
  }
};

export const formatDateTimeToEST = (dateString) => {
   if (!dateString) return '-';
   try {
     const date = new Date(dateString);
     if (isNaN(date.getTime())) return dateString;

     return date.toLocaleString('en-US', {
       timeZone: 'America/New_York',
       year: 'numeric',
       month: 'short',
       day: 'numeric',
       hour: 'numeric',
       minute: 'numeric',
       hour12: true
     });
   } catch (error) {
      return dateString;
   }
}