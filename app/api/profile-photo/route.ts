import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const profilePhotosBucket = "profile-photos";
const maxProfilePhotoSize = 2 * 1024 * 1024;
const acceptedTypes = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

let bucketReady = false;

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json(
    {
      success: false,
      message,
      reason,
    },
    { status },
  );
}

async function getAuthenticatedUser() {
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return {
      user: null,
      error: jsonError("Configuration Supabase manquante.", 500, "supabase_unconfigured"),
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      error: jsonError("Session requise.", 401, "session_missing"),
    };
  }

  return {
    user,
    error: null,
  };
}

async function ensureProfilePhotosBucket(
  adminSupabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
) {
  if (bucketReady) {
    return null;
  }

  const { data: buckets, error: listError } =
    await adminSupabase.storage.listBuckets();

  if (listError) {
    return listError;
  }

  if (buckets?.some((bucket) => bucket.id === profilePhotosBucket)) {
    bucketReady = true;
    return null;
  }

  const { error: createError } = await adminSupabase.storage.createBucket(
    profilePhotosBucket,
    {
      public: false,
      fileSizeLimit: maxProfilePhotoSize,
      allowedMimeTypes: [...acceptedTypes.keys()],
    },
  );

  if (!createError) {
    bucketReady = true;
  }

  return createError;
}

async function getCurrentPhotoPath(
  adminSupabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  userId: string,
) {
  const { data, error } = await adminSupabase.storage
    .from(profilePhotosBucket)
    .list(userId, {
      limit: 10,
      sortBy: {
        column: "updated_at",
        order: "desc",
      },
    });

  if (error || !data) {
    return null;
  }

  const photo = data.find((item) => item.name.startsWith("profile."));

  return photo ? `${userId}/${photo.name}` : null;
}

async function createPhotoResponse(
  adminSupabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  userId: string,
) {
  const path = await getCurrentPhotoPath(adminSupabase, userId);

  if (!path) {
    return NextResponse.json(
      {
        success: true,
        url: null,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const { data, error } = await adminSupabase.storage
    .from(profilePhotosBucket)
    .createSignedUrl(path, 60 * 60);

  if (error) {
    console.error("[profile-photo] signed url failed:", error.message);
    return jsonError("Lecture de la photo impossible.", 500, "db_error");
  }

  return NextResponse.json(
    {
      success: true,
      url: data.signedUrl,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function GET() {
  const { user, error } = await getAuthenticatedUser();

  if (error || !user) {
    return error;
  }

  const adminSupabase = getSupabaseAdminClient();

  if (!adminSupabase) {
    return jsonError("Configuration admin Supabase manquante.", 500, "service_role_unconfigured");
  }

  const bucketError = await ensureProfilePhotosBucket(adminSupabase);

  if (bucketError) {
    console.error("[profile-photo] bucket GET failed:", bucketError.message);
    return jsonError("Stockage photo indisponible.", 500, "db_error");
  }

  return createPhotoResponse(adminSupabase, user.id);
}

export async function POST(request: Request) {
  const { user, error } = await getAuthenticatedUser();

  if (error || !user) {
    return error;
  }

  const adminSupabase = getSupabaseAdminClient();

  if (!adminSupabase) {
    return jsonError("Configuration admin Supabase manquante.", 500, "service_role_unconfigured");
  }

  const bucketError = await ensureProfilePhotosBucket(adminSupabase);

  if (bucketError) {
    console.error("[profile-photo] bucket POST failed:", bucketError.message);
    return jsonError("Stockage photo indisponible.", 500, "db_error");
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("photo");

  if (!(file instanceof File)) {
    return jsonError("Photo requise.", 400, "photo_missing");
  }

  const extension = acceptedTypes.get(file.type);

  if (!extension) {
    return jsonError("Format non pris en charge.", 400, "unsupported_file_type");
  }

  if (file.size > maxProfilePhotoSize) {
    return jsonError("Image trop lourde.", 400, "file_too_large");
  }

  const currentPath = await getCurrentPhotoPath(adminSupabase, user.id);

  if (currentPath) {
    await adminSupabase.storage.from(profilePhotosBucket).remove([currentPath]);
  }

  const path = `${user.id}/profile.${extension}`;
  const { error: uploadError } = await adminSupabase.storage
    .from(profilePhotosBucket)
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error("[profile-photo] upload failed:", uploadError.message);
    return jsonError("Enregistrement de la photo impossible.", 500, "db_error");
  }

  return createPhotoResponse(adminSupabase, user.id);
}

export async function DELETE() {
  const { user, error } = await getAuthenticatedUser();

  if (error || !user) {
    return error;
  }

  const adminSupabase = getSupabaseAdminClient();

  if (!adminSupabase) {
    return jsonError("Configuration admin Supabase manquante.", 500, "service_role_unconfigured");
  }

  const bucketError = await ensureProfilePhotosBucket(adminSupabase);

  if (bucketError) {
    console.error("[profile-photo] bucket DELETE failed:", bucketError.message);
    return jsonError("Stockage photo indisponible.", 500, "db_error");
  }

  const path = await getCurrentPhotoPath(adminSupabase, user.id);

  if (path) {
    const { error: removeError } = await adminSupabase.storage
      .from(profilePhotosBucket)
      .remove([path]);

    if (removeError) {
      console.error("[profile-photo] remove failed:", removeError.message);
      return jsonError("Suppression de la photo impossible.", 500, "db_error");
    }
  }

  return NextResponse.json({
    success: true,
    url: null,
  });
}
