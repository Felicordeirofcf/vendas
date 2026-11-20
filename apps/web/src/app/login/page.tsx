"use client";
import { useActionState, useState } from "react";
import { authAction, type AuthState } from "./actions";
import { btnCls, Field, inputCls } from "@/components/ui";

export default function Login() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [state, action, pending] = useActionState<AuthState, FormData>(authAction, {});
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form action={action} className="w-full max-w-sm space-y-4 rounded-2xl border border-line bg-white p-6">
        <div>
          <h1 className="text-2xl font-extrabold">{mode === "signin" ? "Entrar" : "Criar conta"}</h1>
          <p className="text-sm text-muted">Gestão de lojas de afiliados</p>
        </div>
        <input type="hidden" name="mode" value={mode} />
        <Field label="E-mail"><input className={inputCls} type="email" name="email" required autoComplete="email" /></Field>
        <Field label="Senha"><input className={inputCls} type="password" name="password" required minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} /></Field>
        {state.error ? <p className="text-sm font-semibold text-red-700" role="alert">{state.error}</p> : null}
        {state.unconfirmed ? (
          <button name="mode" value="resend" formNoValidate className="w-full cursor-pointer rounded-xl border border-ink py-2 text-sm font-semibold">
            Reenviar e-mail de confirmação
          </button>
        ) : null}
        {state.info ? <p className="text-sm font-semibold text-green-800" role="status">{state.info}</p> : null}
        <button className={`${btnCls} w-full`} disabled={pending}>{pending ? "Aguarde…" : mode === "signin" ? "Entrar" : "Criar conta"}</button>
        <button type="button" className="w-full cursor-pointer text-sm underline" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
          {mode === "signin" ? "Primeiro acesso? Criar conta" : "Já tenho conta"}
        </button>
      </form>
    </main>
  );
}
