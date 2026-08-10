export const safeFormatDate = (dateVal: any, fallback = "N/A"): string => {
  if (!dateVal) return fallback;
  if (typeof dateVal.toDate === 'function') {
    return dateVal.toDate().toLocaleDateString();
  }
  const d = new Date(dateVal);
  return isNaN(d.getTime()) ? fallback : d.toLocaleDateString();
};

export const safeFormatDateTime = (dateVal: any, fallback = "N/A"): string => {
  if (!dateVal) return fallback;
  if (typeof dateVal.toDate === 'function') {
    return dateVal.toDate().toLocaleString();
  }
  const d = new Date(dateVal);
  return isNaN(d.getTime()) ? fallback : d.toLocaleString();
};

export const safeFormatTime = (dateVal: any, fallback = "N/A"): string => {
  if (!dateVal) return fallback;
  if (typeof dateVal.toDate === 'function') {
    return dateVal.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const d = new Date(dateVal);
  return isNaN(d.getTime()) ? fallback : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};
