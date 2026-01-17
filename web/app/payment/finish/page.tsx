import { Suspense } from 'react';
import PaymentStatusClient from '../status-client';

export default function PaymentFinishPage() {
  return (
    <Suspense fallback={<div className="page" />}>
      <PaymentStatusClient />
    </Suspense>
  );
}
