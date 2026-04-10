import { getSupabaseClient } from "/admin/supabase-client.js";

function mapRow(row) {
  const lastActiveTimestamp = row.last_active ? new Date(row.last_active).getTime() : 0;
  return {
    userId: row.id,
    email: row.email || "",
    isLoggedIn: Boolean(row.is_logged_in),
    hasPaid: Boolean(row.has_paid),
    plan: row.plan === "paid" ? "paid" : "free",
    paymentDate: row.payment_date || null,
    lastActive: Number.isFinite(lastActiveTimestamp) ? lastActiveTimestamp : 0,
  };
}

async function setUserLoggedOut(userId) {
  if (!userId) return;
  const supabase = await getSupabaseClient();
  await supabase
    .from("users")
    .update({ is_logged_in: false, last_active: new Date().toISOString() })
    .eq("id", userId);
}

export async function fetchUsers() {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .order("last_active", { ascending: false });

  if (error) throw error;
  return (data || []).map(mapRow);
}

export async function getCurrentAuthUser() {
  const supabase = await getSupabaseClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    console.error("SESSION ERROR:", sessionError.message);
  }
  console.log("AUTH SESSION:", sessionData?.session || null);

  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.error("AUTH USER ERROR:", error.message);
    throw error;
  }

  console.log("AUTH USER:", data?.user || null);
  return data?.user || null;
}

export async function getUserData(userId) {
  if (!userId) return null;
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  console.log("USER ROW:", data || null);
  console.log("ERROR:", error || null);

  if (error) {
    console.error("SUPABASE ERROR:", error.message);
    return null;
  }

  return data || null;
}

export async function getOrCreateUserData(authUser) {
  if (!authUser?.id) return null;

  const existing = await getUserData(authUser.id);
  if (existing) return existing;

  const supabase = await getSupabaseClient();
  const nowIso = new Date().toISOString();
  const seedRow = {
    id: authUser.id,
    email: authUser.email || authUser.user_metadata?.email || "",
    is_logged_in: true,
    has_paid: false,
    plan: "free",
    payment_date: null,
    last_active: nowIso,
    is_admin: false,
  };

  const { data, error } = await supabase
    .from("users")
    .insert(seedRow)
    .select("*")
    .single();

  if (error) {
    console.error("Error creating missing user row:", error);
    return null;
  }

  console.log("User row created:", data);
  return data || null;
}

export async function isAdminUser(userId) {
  const userData = await getUserData(userId);
  return Boolean(userData?.is_admin);
}

export async function updateUserPayment(userId, newStatus) {
  const supabase = await getSupabaseClient();

  const updates = newStatus
    ? {
        has_paid: true,
        plan: "paid",
        payment_date: new Date().toISOString(),
      }
    : {
        has_paid: false,
        plan: "free",
        payment_date: null,
      };

  const { error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", userId);

  if (error) {
    console.error("Update failed:", error);
    throw error;
  }

  console.log("User updated successfully");
  return updates;
}

export async function updateUserPlan(userId, plan) {
  const nextPlan = plan === "paid" ? "paid" : "free";
  return updateUserPayment(userId, nextPlan === "paid");
}

export async function syncCurrentUserPresence() {
  const supabase = await getSupabaseClient();

  const { data } = await supabase.auth.getSession();
  let previousUserId = data?.session?.user?.id || null;

  if (data?.session?.user) {
    await updateCurrentUserPresence(data.session.user, true);
  }

  const { data: authSubscription } = supabase.auth.onAuthStateChange(async (_event, session) => {
    const currentUser = session?.user || null;

    if (previousUserId && (!currentUser || currentUser.id !== previousUserId)) {
      await setUserLoggedOut(previousUserId);
    }

    if (currentUser) {
      await updateCurrentUserPresence(currentUser, true);
      previousUserId = currentUser.id;
    } else {
      previousUserId = null;
    }
  });

  return () => {
    authSubscription?.subscription?.unsubscribe();
  };
}

export async function markCurrentUserPaid() {
  const supabase = await getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const user = data?.session?.user || null;
  if (!user) return;

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("users")
    .update({
      has_paid: true,
      plan: "paid",
      payment_date: nowIso,
      is_logged_in: true,
      last_active: nowIso,
    })
    .eq("id", user.id);

  if (error) throw error;
}

export async function maybeTrackPaymentFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const paymentStatus = params.get("payment");
  if (paymentStatus !== "success") return;

  await markCurrentUserPaid();
}

export async function subscribeToUsers(onRefresh) {
  const supabase = await getSupabaseClient();
  const channel = supabase
    .channel("admin-users-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "users" },
      () => {
        onRefresh();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function slugifyTitle(title) {
  return String(title || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function generateBlogPostDraft(topic, tone, imagePrompt = "") {
  const supabase = await getSupabaseClient();
  const { data: sessionResult } = await supabase.auth.getSession();
  const accessToken = sessionResult?.session?.access_token || "";

  const response = await fetch("/api/admin/blog/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ topic, tone, imagePrompt }),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    console.error("BLOG GENERATION RESPONSE PARSE ERROR:", error);
    throw new Error(`Blog generation failed (${response.status}). The server returned invalid JSON.`);
  }

  if (!response.ok) {
    let details = payload?.error || `Failed to generate blog post (${response.status}).`;
    if (payload) {
      const extra = [];
      if (payload.code) extra.push(`code: ${payload.code}`);
      if (payload.type) extra.push(`type: ${payload.type}`);
      if (payload.status) extra.push(`status: ${payload.status}`);
      if (payload.stack) extra.push(`stack: ${payload.stack}`);
      if (payload.raw) extra.push(`raw: ${JSON.stringify(payload.raw)}`);
      if (extra.length) details += '\n' + extra.join('\n');
    }
    console.error("BLOG GENERATION REQUEST FAILED:", {
      status: response.status,
      payload,
    });
    throw new Error(details);
  }

  return {
    title: payload?.title || "",
    content: payload?.content || "",
    image: payload?.image || "",
    imagePrompt: payload?.imagePrompt || imagePrompt || "",
    imageSource: payload?.imageSource || "",
  };
}

function getMissingColumnName(error) {
  const message = String(error?.message || "");
  const patterns = [
    /column ["']?([a-zA-Z0-9_]+)["']? does not exist/i,
    /Could not find the ['"]([a-zA-Z0-9_]+)['"] column/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

export async function publishBlogPost({ title, content, authorId, image, imagePrompt }) {
  const supabase = await getSupabaseClient();
  const baseSlug = slugifyTitle(title) || `post-${Date.now()}`;
  const fallbackImage = `https://source.unsplash.com/1600x900/?${encodeURIComponent(
    `${title},professional,resume,office,minimal`
  )}`;

  const buildInsertPayload = (slug) => ({
    title,
    slug,
    content,
    author_id: authorId,
    is_published: true,
    image: image || fallbackImage,
    image_prompt: imagePrompt || null,
  });

  const attemptInsert = async (slug) => {
    const payload = buildInsertPayload(slug);

    while (true) {
      const { data, error } = await supabase
        .from("blog_posts")
        .insert(payload)
        .select("id, slug")
        .single();

      if (!error) {
        return { data, error: null };
      }

      const missingColumn = getMissingColumnName(error);
      if (missingColumn && Object.prototype.hasOwnProperty.call(payload, missingColumn)) {
        delete payload[missingColumn];
        continue;
      }

      return { data: null, error };
    }
  };

  let { data, error } = await attemptInsert(baseSlug);
  if (error && String(error.code) === "23505") {
    const retrySlug = `${baseSlug}-${Date.now()}`;
    ({ data, error } = await attemptInsert(retrySlug));
  }

  if (error) {
    throw error;
  }

  return data;
}

async function updateCurrentUserPresence(user, isLoggedIn) {
  const supabase = await getSupabaseClient();
  const nowIso = new Date().toISOString();

  const { error } = await supabase
    .from("users")
    .update({
      email: user.email || "",
      is_logged_in: Boolean(isLoggedIn),
      last_active: nowIso,
    })
    .eq("id", user.id);

  if (error) {
    console.error("Update error:", error);
  }
}
