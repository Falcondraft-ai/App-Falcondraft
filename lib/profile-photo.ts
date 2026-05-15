export const PROFILE_PHOTO_UPDATED_EVENT = "falcondraft:profile-photo-updated";

export const LEGACY_PROFILE_PHOTO_STORAGE_KEY = "falcondraft:profile-photo";

export type ProfilePhotoResponse =
  | {
      success: true;
      url: string | null;
    }
  | {
      success: false;
      message?: string;
    };

export async function fetchProfilePhotoUrl() {
  const response = await fetch("/api/profile-photo", {
    cache: "no-store",
  }).catch(() => null);

  if (!response?.ok) {
    return null;
  }

  const result = (await response.json().catch(() => null)) as
    | ProfilePhotoResponse
    | null;

  return result?.success ? result.url : null;
}
