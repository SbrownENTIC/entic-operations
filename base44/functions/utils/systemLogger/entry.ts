export async function logSystemEvent(functionName, status = "SUCCESS", message = "") {
  const timestamp = new Date().toISOString();

  console.log(`[SYSTEM LOG] ${timestamp} | ${functionName} | ${status} | ${message}`);

  return {
    timestamp,
    functionName,
    status,
    message
  };
}