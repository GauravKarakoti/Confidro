"use client";

import { useState } from "react";

// This is a simplified version – in a real app you'd need to query events
// or maintain an off-chain list of employees.
export function EmployeeList() {
  const [employees, setEmployees] = useState<string[]>([]);
  // Placeholder: we assume employees are known from events.
  // For demo, we'll show a static message.

  return (
    <div className="space-y-2">
      <p className="text-gray-500 text-sm">Employee addresses will appear here after being added.</p>
      {employees.length === 0 && (
        <div className="bg-gray-50 rounded p-3 text-center text-gray-400">
          No employees added yet.
        </div>
      )}
      {employees.map((emp, idx) => (
        <div key={idx} className="bg-gray-50 p-2 rounded text-sm font-mono break-all">
          {emp}
        </div>
      ))}
    </div>
  );
}