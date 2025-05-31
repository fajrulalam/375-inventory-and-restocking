export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const getFormattedDate = (date: Date): string => {
  // Convert to Jakarta time (GMT+7)
  const jakartaTime = new Date(date.getTime());
  jakartaTime.setHours(jakartaTime.getHours()); // Adjust for GMT+7

  // Format as YYYY-MM-DD
  const year = jakartaTime.getFullYear();
  const month = String(jakartaTime.getMonth() + 1).padStart(2, "0");
  const day = String(jakartaTime.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

export const getFormattedMonth = (date: Date): string => {
  // Convert to Jakarta time (GMT+7)
  const jakartaTime = new Date(date.getTime());
  jakartaTime.setHours(jakartaTime.getHours()); // Adjust for GMT+7

  // Format as YYYY-MM
  const year = jakartaTime.getFullYear();
  const month = String(jakartaTime.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
};

export const getFormattedYear = (date: Date): string => {
  // Convert to Jakarta time (GMT+7)
  const jakartaTime = new Date(date.getTime());
  jakartaTime.setHours(jakartaTime.getHours()); // Adjust for GMT+7

  // Format as YYYY
  return String(jakartaTime.getFullYear());
};
