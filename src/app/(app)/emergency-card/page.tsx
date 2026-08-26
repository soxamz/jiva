import { AlertTriangleIcon, PhoneIcon, ShieldCheckIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getPatientWorkspace } from '@/lib/dal';

export default async function EmergencyCardPage() {
  const data = await getPatientWorkspace();
  const profile = data.profile;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Emergency card</h1>
        <p className="text-muted-foreground text-sm">
          Important health details for you, your family, and first responders.
        </p>
      </div>
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="gap-0 md:col-span-3">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <ShieldCheckIcon aria-hidden />
              <CardTitle>{data.user.name}</CardTitle>
              <Badge variant="success">Verified profile</Badge>
            </div>
            <CardDescription>
              Important information available quickly in an emergency.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className="gap-0">
          <CardHeader>
            <CardTitle className="text-xs font-normal tracking-wide">Blood type</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">{profile?.bloodType ?? 'NA'}</p>
          </CardContent>
        </Card>
        <Card className="gap-0 md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangleIcon aria-hidden />
              <CardTitle>Allergies</CardTitle>
            </div>
            <CardDescription>Tell a doctor about these before treatment.</CardDescription>
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
        </Card>
        <Card className="gap-0">
          <CardHeader>
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
        </Card>
        <Card className="gap-0">
          <CardHeader>
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
        </Card>
        <Card className="gap-0 md:col-span-3">
          <CardHeader>
            <div className="flex items-center gap-2">
              <PhoneIcon aria-hidden />
              <CardTitle>Emergency contacts</CardTitle>
            </div>
            <CardDescription>People to call when you need help.</CardDescription>
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
        </Card>
      </section>
    </div>
  );
}
