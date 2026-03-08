export async function processNarrative(text) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  console.log("[Scanner] processNarrative START - text length:", text.length);
  
  let response;
  try {
    console.log("[Scanner] Sending POST to /api/scanner/scan-text");
    response = await fetch("/api/scanner/scan-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal
    });
    console.log("[Scanner] Response received - status:", response.status);
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("[Scanner] Fetch error:", error.message);
    if (error.name === "AbortError") {
      throw new Error("Scanner request timed out. Please try again.");
    }
    throw new Error("Scanner API unavailable. Start the backend server and retry.");
  }

  let result = {};
  try {
    result = await response.json();
    console.log("[Scanner] JSON parsed - success:", result.success);
  } catch (error) {
    console.error("[Scanner] JSON parse error:", error.message);
    result = { success: false, error: "Invalid scanner response." };
  }
  
  if (!response.ok && result.success !== true) {
    console.error("[Scanner] Request failed - ok:", response.ok, "success:", result.success);
    throw new Error(result.error || "Scanner failed");
  }
  if (!result.success) {
    console.error("[Scanner] Server returned success=false - error:", result.error);
    throw new Error(result.error || "Scanner failed");
  }
  
  clearTimeout(timeoutId);
  console.log("[Scanner] processNarrative SUCCESS - returning data");
  return result.data;
}
