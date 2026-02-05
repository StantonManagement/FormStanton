'use client';

interface InfoTableProps {
  headers: string[];
  rows: string[][];
  className?: string;
}

export default function InfoTable({ headers, rows, className = '' }: InfoTableProps) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-[var(--primary)] text-white">
            {headers.map((header, idx) => (
              <th
                key={idx}
                className="px-4 py-3 text-left font-medium border border-[var(--primary)]"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr 
              key={rowIdx} 
              className="border-b border-[var(--divider)] hover:bg-[var(--bg-section)] transition-colors"
            >
              {row.map((cell, cellIdx) => (
                <td
                  key={cellIdx}
                  className="px-4 py-3 border-x border-[var(--divider)] text-[var(--ink)]"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
