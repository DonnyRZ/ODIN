import { Suspense } from 'react';
import PaymentStatusClient from '../status-client';

export default function PaymentErrorPage() {
  return (
    <Suspense fallback={<div className="page" />}>
      <PaymentStatusClient />
    </Suspense>
  );
}
