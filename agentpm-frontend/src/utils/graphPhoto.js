/** Fetches the Azure AD profile photo using a Graph token and stores it
 *  as a base64 data-URL in sessionStorage.
 *  Returns true on success, false if the user has no photo set. */
export async function fetchAndStorePhoto(graphToken) {
  const res = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
    headers: { Authorization: `Bearer ${graphToken}` },
  });
  if (!res.ok) return false;

  const blob = await res.blob();
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  sessionStorage.setItem('userPhoto', base64);
  sessionStorage.removeItem('photoConsentNeeded');
  window.dispatchEvent(new Event('userPhotoReady'));
  return true;
}
