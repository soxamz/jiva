import { getAppShellUser } from "@/lib/dal";
import { MobileProfile } from "@/components/mobile/mobile-profile";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ProfilePage() {
  const user = await getAppShellUser();

  return (
    <>
      {/* Mobile screen view */}
      <MobileProfile user={user} />

      {/* Desktop fallback panel */}
      <div className="hidden md:block max-w-xl mx-auto my-12">
        <Card className="border border-[#E2E8F0] shadow-sm rounded-[16px]">
          <CardHeader className="border-b border-[#F1F5F9]">
            <CardTitle className="text-lg font-bold text-[#111827]">
              Patient Profile Workspace
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 flex flex-col gap-4 text-center">
            <div className="size-16 rounded-full bg-[#E6F4F1] border border-teal-200/50 flex items-center justify-center text-[#0D5F5A] font-bold text-xl mx-auto">
              {user.name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2)}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#111827]">{user.name}</h3>
              <p className="text-[#64748B] text-xs mt-0.5">{user.phoneMasked}</p>
            </div>
            <p className="text-[#64748B] text-xs mt-2 leading-relaxed">
              Use the sidebar navigation to access your JivaHQ features on desktop.
            </p>
            <div className="flex gap-3 justify-center mt-4">
              <Link
                href="/dashboard"
                className="bg-[#0D5F5A] text-white px-4 py-2 rounded-xl text-xs font-bold active:scale-95 transition-transform"
              >
                Go to Dashboard
              </Link>
              <Link
                href="/health-information"
                className="border border-[#E2E8F0] text-[#0D5F5A] bg-white px-4 py-2 rounded-xl text-xs font-bold active:scale-95 transition-transform"
              >
                Health Info
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
