export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header */}
      <div
        className="rounded-lg border p-5"
        style={{
          backgroundColor: "var(--background-card)",
          borderColor: "var(--border)",
        }}
      >
        <div
          className="h-3 w-24 rounded"
          style={{ backgroundColor: "var(--background-subtle)" }}
        />
        <div className="mt-3 flex items-center gap-3">
          <div
            className="h-6 w-48 rounded"
            style={{ backgroundColor: "var(--background-subtle)" }}
          />
          <div
            className="h-5 w-16 rounded"
            style={{ backgroundColor: "var(--background-subtle)" }}
          />
        </div>
        <div
          className="mt-2 h-3 w-64 rounded"
          style={{ backgroundColor: "var(--background-subtle)" }}
        />
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border p-4"
            style={{
              backgroundColor: "var(--background-card)",
              borderColor: "var(--border)",
            }}
          >
            <div
              className="h-3 w-20 rounded"
              style={{ backgroundColor: "var(--background-subtle)" }}
            />
            <div
              className="mt-3 h-7 w-16 rounded"
              style={{ backgroundColor: "var(--background-subtle)" }}
            />
            <div
              className="mt-2 h-2.5 w-28 rounded"
              style={{ backgroundColor: "var(--background-subtle)" }}
            />
          </div>
        ))}
      </div>

      {/* Content area */}
      <div
        className="rounded-lg border"
        style={{
          backgroundColor: "var(--background-card)",
          borderColor: "var(--border)",
        }}
      >
        <div
          className="border-b px-4 py-3.5"
          style={{ borderColor: "var(--border)" }}
        >
          <div
            className="h-3.5 w-32 rounded"
            style={{ backgroundColor: "var(--background-subtle)" }}
          />
        </div>
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-4">
              <div
                className="h-8 w-8 shrink-0 rounded"
                style={{ backgroundColor: "var(--background-subtle)" }}
              />
              <div className="flex-1 space-y-2">
                <div
                  className="h-3 w-1/3 rounded"
                  style={{ backgroundColor: "var(--background-subtle)" }}
                />
                <div
                  className="h-2.5 w-1/2 rounded"
                  style={{ backgroundColor: "var(--background-subtle)" }}
                />
              </div>
              <div
                className="h-5 w-16 rounded"
                style={{ backgroundColor: "var(--background-subtle)" }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
