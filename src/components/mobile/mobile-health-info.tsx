"use client";

import { useActionState, useState, useEffect } from "react";
import Link from "next/link";
import { updateMedicalProfileAction, type FormState } from "@/lib/actions";
import { ShieldCheckIcon, SaveIcon, Loader2, CheckIcon } from "lucide-react";
import { MobileHeader } from "./mobile-header";
import { cn } from "@/lib/utils";

interface MobileHealthInfoProps {
  data: {
    profile: {
      bloodType: string;
      allergies: string[];
      criticalConditions: string[];
      currentMedications: string[];
      emergencyContacts: Array<{
        name: string;
        relation: string;
        phone: string;
      }>;
    } | null;
  };
}

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"];

export function MobileHealthInfo({ data }: MobileHealthInfoProps) {
  const profile = data.profile;

  // Convert array lists to comma strings
  const initialAllergies = profile?.allergies?.join(", ") ?? "";
  const initialConditions = profile?.criticalConditions?.join(", ") ?? "";
  const initialMeds = profile?.currentMedications?.join(", ") ?? "";
  const initialContacts = (profile?.emergencyContacts ?? [])
    .map((c) => `${c.name} | ${c.relation} | ${c.phone}`)
    .join("\n");

  const [selectedBlood, setSelectedBlood] = useState(profile?.bloodType ?? "Unknown");
  const [allergiesText, setAllergiesText] = useState(initialAllergies);
  const [conditionsText, setConditionsText] = useState(initialConditions);
  const [medsText, setMedsText] = useState(initialMeds);
  const [contactsText, setContactsText] = useState(initialContacts);

  // Setup form action state using updateMedicalProfileAction
  const [state, action, pending] = useActionState<FormState, FormData>(
    updateMedicalProfileAction,
    undefined
  );

  const [showSavedToast, setShowSavedToast] = useState(false);

  useEffect(() => {
    if (state && !state.errors && !pending) {
      const showTimer = setTimeout(() => setShowSavedToast(true), 0);
      const hideTimer = setTimeout(() => setShowSavedToast(false), 3000);
      return () => {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
      };
    }
  }, [state, pending]);

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC] pb-24 md:hidden">
      <MobileHeader
        title="Health information"
        showBack
        backHref="/profile"
        rightElement={
          <Link
            href="/emergency-card"
            className="flex items-center gap-1 bg-[#E6F4F1] text-[#0D5F5A] text-[11px] font-bold px-3 py-1.5 rounded-full active:scale-95 transition-transform"
          >
            <ShieldCheckIcon className="size-3.5" />
            <span>Card</span>
          </Link>
        }
      />

      <div className="p-4">
        {/* Form panel */}
        <form action={action} className="bg-white rounded-[20px] border border-[#E2E8F0] p-5 shadow-sm flex flex-col gap-5">
          <div>
            <span className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider block">
              Your health record
            </span>
            <h2 className="text-sm font-bold text-[#111827] mt-1">
              Emergency details
            </h2>
            <p className="text-[#64748B] text-[11px] mt-1 leading-relaxed">
              This information is shown on your emergency card and shared with doctors during medical checkups.
            </p>
          </div>

          {/* Blood group selection */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-bold text-[#111827] uppercase tracking-wider">
              Blood group
            </span>
            {/* Hidden Input to register bloodType inside FormData */}
            <input type="hidden" name="bloodType" value={selectedBlood} />
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {BLOOD_GROUPS.map((bg) => {
                const active = selectedBlood === bg;
                return (
                  <button
                    key={bg}
                    type="button"
                    onClick={() => setSelectedBlood(bg)}
                    className={cn(
                      "px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors shrink-0",
                      active
                        ? "bg-[#0D5F5A] border-[#0D5F5A] text-white"
                        : "bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B]"
                    )}
                  >
                    {bg}
                  </button>
                );
              })}
            </div>
            {state?.errors?.bloodType && (
              <span className="text-red-500 text-[10px] font-bold">{state.errors.bloodType.join(", ")}</span>
            )}
          </div>

          {/* Allergies input */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="mobile-allergies" className="text-[11px] font-bold text-[#111827] uppercase tracking-wider">
              Allergies
            </label>
            <input
              id="mobile-allergies"
              name="allergies"
              type="text"
              placeholder="e.g. Penicillin, Peanuts"
              value={allergiesText}
              onChange={(e) => setAllergiesText(e.target.value)}
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-[10px] px-3.5 py-2.5 text-base text-[#111827] focus:outline-none focus:border-[#0D5F5A]"
            />
            <span className="text-[10px] text-[#64748B]">Separate each item with a comma.</span>
            {state?.errors?.allergies && (
              <span className="text-red-500 text-[10px] font-bold">{state.errors.allergies.join(", ")}</span>
            )}
          </div>

          {/* Critical conditions input */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="mobile-conditions" className="text-[11px] font-bold text-[#111827] uppercase tracking-wider">
              Critical conditions
            </label>
            <input
              id="mobile-conditions"
              name="criticalConditions"
              type="text"
              placeholder="e.g. Diabetes, Asthma"
              value={conditionsText}
              onChange={(e) => setConditionsText(e.target.value)}
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-[10px] px-3.5 py-2.5 text-base text-[#111827] focus:outline-none focus:border-[#0D5F5A]"
            />
            <span className="text-[10px] text-[#64748B]">Separate each item with a comma.</span>
            {state?.errors?.criticalConditions && (
              <span className="text-red-500 text-[10px] font-bold">{state.errors.criticalConditions.join(", ")}</span>
            )}
          </div>

          {/* Current medicines input */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="mobile-meds" className="text-[11px] font-bold text-[#111827] uppercase tracking-wider">
              Current medicines
            </label>
            <input
              id="mobile-meds"
              name="currentMedications"
              type="text"
              placeholder="e.g. Metformin 500mg, Vitamin D"
              value={medsText}
              onChange={(e) => setMedsText(e.target.value)}
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-[10px] px-3.5 py-2.5 text-base text-[#111827] focus:outline-none focus:border-[#0D5F5A]"
            />
            <span className="text-[10px] text-[#64748B]">Separate each item with a comma.</span>
            {state?.errors?.currentMedications && (
              <span className="text-red-500 text-[10px] font-bold">{state.errors.currentMedications.join(", ")}</span>
            )}
          </div>

          {/* Emergency contacts input */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="mobile-contacts" className="text-[11px] font-bold text-[#111827] uppercase tracking-wider">
              Emergency contacts
            </label>
            <textarea
              id="mobile-contacts"
              name="emergencyContacts"
              rows={4}
              placeholder="Asha Sharma | Mother | 9876543210&#10;Rohan Sharma | Brother | 9876543211"
              value={contactsText}
              onChange={(e) => setContactsText(e.target.value)}
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-[10px] p-3.5 text-base text-[#111827] focus:outline-none focus:border-[#0D5F5A]"
            />
            <span className="text-[10px] text-[#64748B] leading-normal">
              Use one contact per line: name | relation | phone number.
            </span>
            {state?.errors?.emergencyContacts && (
              <span className="text-red-500 text-[10px] font-bold">{state.errors.emergencyContacts.join(", ")}</span>
            )}
          </div>

          {state?.message && (
            <p className="text-red-500 text-xs font-bold leading-normal">{state.message}</p>
          )}

          {/* Save button */}
          <button
            type="submit"
            disabled={pending}
            className="w-full flex items-center justify-center gap-2 bg-[#0D5F5A] text-white py-3.5 rounded-[12px] text-xs font-bold active:scale-[0.99] transition-transform disabled:opacity-60"
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Saving details...</span>
              </>
            ) : showSavedToast ? (
              <>
                <CheckIcon className="size-4 text-emerald-300" />
                <span>Saved successfully!</span>
              </>
            ) : (
              <>
                <SaveIcon className="size-4" />
                <span>Save health information</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
