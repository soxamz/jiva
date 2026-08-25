import { AlertTriangleIcon, PhoneIcon, ShieldCheckIcon } from 'lucide-react';

import { DashboardCard } from '@/components/dashboard-card';
import { Badge } from '@/components/ui/badge';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getPatientWorkspace } from '@/lib/dal';

export default async function EmergencyCardPage() {
  const data = await getPatientWorkspace();
  const profile = data.profile;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Offline emergency card</h1>
        <p className="text-muted-foreground text-sm">
          Critical profile summary for first responders.
        </p>
      </div>
      <section className="bg-border grid grid-cols-1 gap-px p-px md:grid-cols-3">
        <DashboardCard className="gap-0 md:col-span-3">
          <CardHeader className="border-b">
            <div className="flex flex-wrap items-center gap-2">
              <ShieldCheckIcon aria-hidden />
              <CardTitle>{data.user.name}</CardTitle>
              <Badge variant="success">Verified profile</Badge>
            </div>
            <CardDescription>Offline-style critical care summary.</CardDescription>
          </CardHeader>
        </DashboardCard>
        <DashboardCard className="gap-0">
          <CardHeader>
            <CardTitle className="text-xs font-normal tracking-wide">Blood type</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">{profile?.bloodType ?? 'NA'}</p>
          </CardContent>
        </DashboardCard>
        <DashboardCard className="gap-0 md:col-span-2">
          <CardHeader className="border-b">
            <div className="flex items-center gap-2">
              <AlertTriangleIcon aria-hidden />
              <CardTitle>Allergies</CardTitle>
            </div>
            <CardDescription>Immediate contraindication information.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {(profile?.allergies ?? []).length ? (
              profile?.allergies.map((allergy) => (
                <Badge key={allergy} variant="destructive">
                  {allergy}
                </Badge>
              ))
            ) : (
              <Badge variant="secondary">No allergies listed</Badge>
            )}
          </CardContent>
        </DashboardCard>
        <DashboardCard className="gap-0">
          <CardHeader className="border-b">
            <CardTitle>Critical conditions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {(profile?.criticalConditions ?? []).length ? (
              profile?.criticalConditions.map((condition) => (
                <Badge key={condition} variant="warning">
                  {condition}
                </Badge>
              ))
            ) : (
              <Badge variant="secondary">None listed</Badge>
            )}
          </CardContent>
        </DashboardCard>
        <DashboardCard className="gap-0">
          <CardHeader className="border-b">
            <CardTitle>Current medications</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {(profile?.currentMedications ?? []).length ? (
              profile?.currentMedications.map((medication) => (
                <Badge key={medication} variant="secondary">
                  {medication}
                </Badge>
              ))
            ) : (
              <Badge variant="secondary">None listed</Badge>
            )}
          </CardContent>
        </DashboardCard>
        <DashboardCard className="gap-0 md:col-span-3">
          <CardHeader className="border-b">
            <div className="flex items-center gap-2">
              <PhoneIcon aria-hidden />
              <CardTitle>Emergency contacts</CardTitle>
            </div>
            <CardDescription>Contact details stored in the verified profile.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-border grid grid-cols-1 divide-y md:grid-cols-2 md:divide-x md:divide-y-0">
              {(profile?.emergencyContacts ?? []).map((contact) => (
                <li key={contact.phone} className="flex flex-col gap-1 px-6 py-4">
                  <p className="font-medium">{contact.name}</p>
                  <p className="text-muted-foreground text-sm">{contact.relation}</p>
                  <p className="font-mono text-sm">{contact.phone}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </DashboardCard>
      </section>
    </div>
  );
}
