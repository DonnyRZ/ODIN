import { Suspense } from 'react';
import PaymentStatusClient from '../status-client';

export default function PaymentUnfinishPage() {
  return (
    <Suspense fallback={<div className="page" />}>
      <PaymentStatusClient />
    </Suspense>
  );
}
