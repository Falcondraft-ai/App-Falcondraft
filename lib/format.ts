const frenchDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const frenchDateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const euroFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function formatDate(date: string): string {
  return frenchDateFormatter.format(new Date(date));
}

export function formatDateTime(date: string): string {
  return frenchDateTimeFormatter.format(new Date(date));
}

export function formatCurrency(amount: number): string {
  return euroFormatter.format(amount);
}
