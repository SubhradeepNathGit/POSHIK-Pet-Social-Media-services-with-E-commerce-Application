'use client';

export function SkeletonList() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm animate-pulse">
          {/* Header */}
          <div className="flex items-center space-x-3 p-4">
            <div className="h-10 w-10 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 rounded bg-gray-200" />
              <div className="h-3 w-1/4 rounded bg-gray-200" />
            </div>
            <div className="h-6 w-6 rounded-full bg-gray-200" />
          </div>
          
          {/* Content */}
          <div className="px-4 pb-3">
            <div className="h-4 w-3/4 rounded bg-gray-200" />
          </div>
          
          {/* Media */}
          <div className="aspect-square bg-gray-200" />
          
          {/* Actions */}
          <div className="p-4 space-y-3">
            <div className="flex space-x-6">
              <div className="h-6 w-6 rounded bg-gray-200" />
              <div className="h-6 w-6 rounded bg-gray-200" />
              <div className="h-6 w-6 rounded bg-gray-200" />
            </div>
            <div className="h-4 w-1/4 rounded bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Spinner({ show, label }: { show: boolean; label?: string }) {
  if (!show) return null;
  return (
    <div className="flex items-center gap-3 text-sm text-gray-600">
      <div className="h-6 w-6 rounded-full border-2 border-gray-300 border-t-[#FF8A65] animate-spin" />
      {label && <span>{label}</span>}
    </div>
  );
}






