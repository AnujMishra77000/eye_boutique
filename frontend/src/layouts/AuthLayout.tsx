import { Outlet } from "react-router-dom";

export function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-matte-gradient p-5 sm:p-8">
      <div className="w-full max-w-lg rounded-2xl border border-pink-300/25 bg-matte-900/80 p-6 shadow-neon-glow backdrop-blur sm:p-8">
        <Outlet />
      </div>
    </div>
  );
}
