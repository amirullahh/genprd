import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { googleEnabled } from "@/lib/auth";

export const metadata = { title: "Sign up" };

export default function Page() {
  return (
    <Suspense>
      <AuthForm mode="sign-up" googleEnabled={googleEnabled} />
    </Suspense>
  );
}
