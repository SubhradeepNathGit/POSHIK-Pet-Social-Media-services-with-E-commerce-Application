'use client';

interface DiffLabelProps {
  field: string;
}

export function DiffLabel({ field }: DiffLabelProps) {
  return (
    <p className="text-sm font-semibold text-[#0d1b22] mb-2">
      Updated <span className="rounded-full bg-gradient-to-r from-[#FF8A65] to-[#0e2a36] text-white px-2 py-1 text-xs font-medium">{field}</span>
    </p>
  );
}






