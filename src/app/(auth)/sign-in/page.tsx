import { SignInForm } from '@/components/auth/sign-in-form';

export default async function SignInPage({
  searchParams,
}: PageProps<'/sign-in'>) {
  const { next } = await searchParams;
  const returnTo = typeof next === 'string' ? next : undefined;

  return <SignInForm returnTo={returnTo} />;
}
