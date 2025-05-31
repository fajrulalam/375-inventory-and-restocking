export const getPreviousSameDayDates = (
  date: Date,
  count: number
): string[] => {
  const dates: string[] = [];
  let currentDate = new Date(date);
  const dayOfWeek = currentDate.getDay();

  // We need to generate more dates than required to account for missing data
  // Let's generate 2x the count to be safe
  for (let i = 0; i < count * 3; i++) {
    // Go back 7 days to get the same day of week
    currentDate.setDate(currentDate.getDate() - 7);

    // Make sure it's the same day of the week
    if (currentDate.getDay() === dayOfWeek) {
      // Format the date in Jakarta time (GMT+7)
      const jakartaTime = new Date(currentDate.getTime());
      jakartaTime.setHours(jakartaTime.getHours()); // Adjust for GMT+7

      // Format as YYYY-MM-DD
      const year = jakartaTime.getFullYear();
      const month = String(jakartaTime.getMonth() + 1).padStart(2, "0");
      const day = String(jakartaTime.getDate()).padStart(2, "0");

      dates.push(`${year}-${month}-${day}`);
    }
  }

  return dates;
};

/**
 * Calculate the median of a list of numbers
 * For n numbers sorted in ascending order:
 * - If n is odd, median is the value at index (n+1)/2
 * - If n is even, median is the average of the two middle values
 */
export const calculateMedian = (numbers: number[]): number => {
  if (numbers.length === 0) return 0;
  
  // Get last 8 data points if there are more than 8
  const last8 = numbers.length > 8 ? numbers.slice(-8) : numbers;
  
  // Sort in ascending order
  const sorted = [...last8].sort((a, b) => a - b);
  
  // Calculate median based on odd/even length
  if (sorted.length % 2 === 1) {
    // Odd length: return the middle value
    // For an array of length n, middle index is (n-1)/2
    const middleIndex = Math.floor(sorted.length / 2);
    return sorted[middleIndex];
  } else {
    // Even length: return average of two middle values
    const upperMiddleIndex = sorted.length / 2;
    const lowerMiddleIndex = upperMiddleIndex - 1;
    return (sorted[lowerMiddleIndex] + sorted[upperMiddleIndex]) / 2;
  }
};
