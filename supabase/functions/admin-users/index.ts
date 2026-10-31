import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return json({ error: "Sessão não informada." }, 401);

  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await caller.auth.getUser();
  if (authError || !authData.user) return json({ error: "Sessão inválida." }, 401);

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: callerProfile, error: callerProfileError } = await admin
    .from("profiles").select("role").eq("user_id", authData.user.id).single();
  if (callerProfileError || callerProfile?.role !== "master") {
    return json({ error: "Acesso restrito ao usuário master." }, 403);
  }

  try {
    const input = await req.json();
    const email = String(input.email || "").trim().toLowerCase();
    const display_name = String(input.display_name || "").trim();
    const role = input.role === "master" ? "master" : "common";
    const password = String(input.password || "");
    const allowedModules = new Set(["painel","calendario","entradas","metas","assinaturas","planejamento","moto","dividas","inteligencia","simulador","quitacao","lembretes","cartoes","bancos","projecao","investimentos","patrimonio","relatorios"]);
    const requestedAccess = input.module_access && typeof input.module_access === "object" ? input.module_access : {};
    const module_access = Object.fromEntries([...allowedModules].map((key) => [key, requestedAccess[key] !== false]));

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Informe um e-mail válido." }, 400);
    }
    if (!display_name) return json({ error: "Informe o nome do usuário." }, 400);
    if (password && password.length < 8) return json({ error: "A senha precisa ter pelo menos 8 caracteres." }, 400);

    let userId = String(input.user_id || "");
    if (!userId) {
      if (!password) return json({ error: "Defina uma senha inicial." }, 400);
      const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { display_name, financas_new_account: true },
      });
      if (error) return json({ error: error.message }, 400);
      userId = data.user.id;
    } else {
      if (userId === authData.user.id && role !== "master") {
        return json({ error: "Você não pode remover seu próprio acesso master." }, 400);
      }
      const { data: existingProfile } = await admin.from("profiles").select("*").eq("user_id", userId).maybeSingle();
      const previousProfile = existingProfile || null;
      const { error: profileError } = await admin.from("profiles").upsert({
        user_id: userId, email, display_name, role, module_access,
      }, { onConflict: "user_id" });
      if (profileError) return json({ error: profileError.message }, 500);
      const { data: targetAuth, error: targetAuthError } = await admin.auth.admin.getUserById(userId);
      if (targetAuthError || !targetAuth.user) {
        if (previousProfile) await admin.from("profiles").upsert(previousProfile, { onConflict: "user_id" });
        else await admin.from("profiles").delete().eq("user_id", userId);
        return json({ error: targetAuthError?.message || "Conta de autenticação não encontrada." }, 404);
      }
      const attributes: Record<string, unknown> = {
        email, email_confirm: true,
        user_metadata: { ...(targetAuth.user.user_metadata || {}), display_name },
      };
      if (password) attributes.password = password;
      const { error } = await admin.auth.admin.updateUserById(userId, attributes);
      if (error) {
        if (previousProfile) await admin.from("profiles").upsert(previousProfile, { onConflict: "user_id" });
        else await admin.from("profiles").delete().eq("user_id", userId);
        return json({ error: error.message }, 400);
      }
      return json({ success: true, user_id: userId, email, role });
    }

    const { error: profileError } = await admin.from("profiles").upsert({
      user_id: userId, email, display_name, role, module_access,
    }, { onConflict: "user_id" });
    if (profileError) {
      await admin.auth.admin.deleteUser(userId);
      return json({ error: profileError.message }, 500);
    }

    return json({ success: true, user_id: userId, email, role });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Erro inesperado." }, 500);
  }
});
