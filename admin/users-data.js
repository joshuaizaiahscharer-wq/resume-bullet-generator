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

export async function syncCurrentUserPresence() {
  const supabase = await getSupabaseClient();

  const { data } = await supabase.auth.getSession();
  let previousUserId = data?.session?.user?.id || null;

  if (data?.session?.user) {
    await upsertCurrentUser(data.session.user, true);
  }

  const { data: authSubscription } = supabase.auth.onAuthStateChange(async (_event, session) => {
    const currentUser = session?.user || null;

    if (previousUserId && (!currentUser || currentUser.id !== previousUserId)) {
      await setUserLoggedOut(previousUserId);
    }

    if (currentUser) {
      await upsertCurrentUser(currentUser, true);
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

async function upsertCurrentUser(user, isLoggedIn) {
  const supabase = await getSupabaseClient();
  const nowIso = new Date().toISOString();

  const payload = {
    id: user.id,
    email: user.email || "",
    is_logged_in: Boolean(isLoggedIn),
    last_active: nowIso,
  };

  const { error } = await supabase
    .from("users")
    .upsert(payload, { onConflict: "id" });

  if (error) throw error;
}
