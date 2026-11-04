import Link from 'next/link'
import { CustomerAuthForm } from '@/components/customer/auth-form'

export default function ForgotPasswordPage() {
  return <CustomerAuthForm mode="login" />
}
