"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import LoginForm from "./LoginForm";
import RegisterForm from "./RegisterForm";

type Mode = "login" | "register";

export default function AuthCard() {
  const [mode, setMode] = useState<Mode>("login");

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-dot-grid px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute left-[8%] top-[18%] hidden h-24 w-36 -rotate-6 rounded-lg border-2 border-dashed border-dot sm:block"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[16%] right-[10%] hidden h-20 w-20 rotate-3 rounded-md bg-sticky/40 sm:block"
      />

      <div className="relative z-10 w-full max-w-sm">
        <div className="relative flex px-3">
          {(["login", "register"] as Mode[]).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`relative -mb-px rounded-t-lg px-5 pb-3 pt-2.5 font-display text-sm font-semibold transition-all ${
                  active
                    ? "z-10 -rotate-1 bg-white text-ink shadow-[0_-2px_10px_rgba(0,0,0,0.04)]"
                    : "rotate-1 bg-white/60 text-ink/40 hover:text-ink/70"
                } ${m === "register" ? "-ml-2" : ""}`}
                style={{ transformOrigin: "bottom center" }}
              >
                {m === "login" ? "Log in" : "Sign up"}
                {active && (
                  <motion.div
                    layoutId="auth-tab-underline"
                    className={`absolute bottom-0 left-3 right-3 h-[3px] rounded-full ${
                      m === "login" ? "bg-marker-blue" : "bg-marker-coral"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="relative rotate-[-0.6deg] rounded-2xl rounded-tl-none bg-white p-8 shadow-[0_20px_50px_rgba(31,41,51,0.12)] transition-transform duration-300 focus-within:rotate-0 hover:rotate-0">
          <div className="absolute -top-2.5 left-8 h-5 w-5 rounded-full bg-marker-blue shadow-[0_2px_4px_rgba(0,0,0,0.25)]" />

          <div className="mb-6">
            <p className="font-display text-xl font-semibold text-ink">Miro Lite</p>
            <p className="mt-1 text-sm text-ink/50">Your team&apos;s shared canvas.</p>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, x: mode === "login" ? -8 : 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: mode === "login" ? 8 : -8 }}
              transition={{ duration: 0.16 }}
            >
              {mode === "login" ? <LoginForm /> : <RegisterForm />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}