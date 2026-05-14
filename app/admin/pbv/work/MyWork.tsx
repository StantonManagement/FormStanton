'use client';

import { useState, useCallback } from 'react';
import MyQueue from './panels/MyQueue';
import AwaitingMyConfirmation from './panels/AwaitingMyConfirmation';
import AppsILead from './panels/AppsILead';
import FreshActivity from './panels/FreshActivity';
import StaleTouched from './panels/StaleTouched';
import RecentlyCompleted from './panels/RecentlyCompleted';

interface MyWorkProps {
  refreshTrigger?: number;
}

export default function MyWork({ refreshTrigger }: MyWorkProps) {
  return (
    <div className="space-y-6">
      {/* My Queue - first/most actionable */}
      <MyQueue refreshTrigger={refreshTrigger} />

      {/* Awaiting My Confirmation */}
      <AwaitingMyConfirmation refreshTrigger={refreshTrigger} />

      {/* Apps I Lead */}
      <AppsILead refreshTrigger={refreshTrigger} />

      {/* Fresh Activity */}
      <FreshActivity refreshTrigger={refreshTrigger} />

      {/* Stale Touched */}
      <StaleTouched refreshTrigger={refreshTrigger} />

      {/* Recently Completed */}
      <RecentlyCompleted refreshTrigger={refreshTrigger} />
    </div>
  );
}
