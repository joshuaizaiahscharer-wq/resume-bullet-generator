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
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data?.user || null;
}

export async function getUserData(userId) {
  if (!userId) return null;
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("SUPABASE ERROR:", error.message);
    return null;
  }

  console.log("User data:", data);
  return data;
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
