function cleanUserName(rawName, email) {
  if (!rawName) return "";
  const trimmed = rawName.trim();
  const lower = trimmed.toLowerCase();
  if (email && lower === email.trim().toLowerCase()) {
    return "";
  }
  return trimmed;
}
console.log(cleanUserName("محمد فاضل", "mohamed@gmail.com"));
